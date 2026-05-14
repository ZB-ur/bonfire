# Bonfire Dogfood Findings Log

Persona: 中度 B 站直播观众,游戏区 + VTuber 混看,基础 dev 能力 (Python/Bash 熟,JS/TS 浅),自用 sideload + 开源 GitHub,不上架商店,不长期维护。

Seed (verbatim): `做一个 B 站直播间弹幕降噪 Chrome 插件`

---

### [stage-a] 2026-05-07T15:46:58Z `challenged_claim` entry has empty `challenged_by: []`
- **Symptom**: `truth-propose --id CLAIM-001 --category challenged_claim` 立即返回 `status: "CHALLENGED"`, 但 `challenged_by: []` 为空。
- **Expected**: 一个 entry 处于 CHALLENGED 状态意味着应至少有一个 challenger ID 在 `challenged_by`,或最起码状态应保持 PROPOSED 直到第一个 challenger 关联进来。
- **Actual**: CLI 同时声明 `status=CHALLENGED` 与 `challenged_by=[]` —— 状态语义自相矛盾。
- **Severity**: 🟠 production-grade (语义一致性问题, downstream 任何按 challenged_by 走的统计/检查都会被这条 entry 误导)
- **Workaround**: 继续记录并使用,行为上 challenge_claim 仍能通过 supersede 流转。
- **Hypothesis**: `truth-propose` 在 category=challenged_claim 时直接把 status 提到 CHALLENGED 而不是只在 supersede/explicit-challenge 时提升;状态机应分离"category=challenged_claim" 与 "status=CHALLENGED"。

### [stage-a] 2026-05-07T15:50Z 渲染器与 stage-playbook 文档对 approval_pack 嵌套结构定义不一致 (RENDER ERROR)
- **Symptom**: `bundle/10-a-preprocess.md` 五个章节 (Reframed Goal / Retained Scope / Excluded Scope / Critical Assumptions / Frozen for Code) 全部输出 `<!-- RENDER ERROR: missing required field "<name>" in source data -->`,即便我已按 `references/stage-playbook.md` 第 56 行规定把这些字段放进 `case.json#stages.preprocess.approval_pack` 子对象。
- **Expected**: 文档与 renderer 一致。要么 renderer 从 `stages.preprocess.approval_pack.<field>` 解析,要么文档明确说应放 `stages.preprocess.<field>` 顶层。
- **Actual**: `references/approval-gate.md` 与 `stage-playbook.md` 描述这些字段是 "approval pack" 的一部分,且 stage-playbook 第 56 行把 `approval_pack` 列为 stages.preprocess 顶层字段;但 renderer 反向期望 `reframed_goal` 等是 stages.preprocess 顶层字段而不是 approval_pack 内部。两份描述自相矛盾。
- **Severity**: 🟠 production-grade (任何按文档放数据的人都会立即触发 5 个 RENDER ERROR; 相当于文档规定的合法布局直接产出 bundle 红色字段)
- **Workaround**: 把 5 个字段同时放到 stages.preprocess 顶层 + approval_pack 子对象(双写)以兼容渲染器。
- **Hypothesis**: renderer 模板在迁移过程中未跟随 schema 文档更新;或 schema 文档未跟随 renderer 改动。需要决定单一权威源。

### [stage-b] 2026-05-07T15:54Z stages.divergence 必需字段名 `retained_option` 未文档化
- **Symptom**: `bundle/20-b-divergence.md` 输出 `<!-- RENDER ERROR: missing required field "retained_option" in source data -->`
- **Expected**: stage-playbook.md 第 67-70 行只说 "Retain exactly one path",未规定 case.json#stages.divergence 的字段命名;ecl-schema.md 也未列出 divergence 子结构。renderer 应文档化或接受合理别名 (retained_option_id / retained_option)。
- **Actual**: 我使用 `retained_option_id: "OPT-C"` (符合直觉 ID 引用风格), renderer 期望 `retained_option`。
- **Severity**: 🟡 ergonomic (任何首次跑 stage B 的用户会撞上未文档字段名)
- **Workaround**: 同时写 `retained_option`(对象或字符串) 与 `retained_option_id`。
- **Hypothesis**: renderer 内部模板硬编码 field name, 但 schema 文档未列 divergence 内部结构。建议补 ecl-schema.md 的 divergence section。

### [stage-c] 2026-05-07T15:55Z stages.requirements 必需字段名 `requirement_units` 未文档化, 与 stage-playbook 用语 "requirement units" 不直接对应
- **Symptom**: `bundle/30-c-requirements.md` 输出 `<!-- RENDER ERROR: missing required field "requirement_units" in source data -->`
- **Expected**: stage-playbook.md "Decompose the retained path into requirement units" 但未规定字段名应为 `requirement_units` 还是 `units`. ecl-schema.md 也无 stages.requirements 的内部结构。
- **Actual**: 与 stage-b 同模式 (renderer hardcoded field, schema docs missing). 三次撞同一类问题(stage A/B/C)了。
- **Severity**: 🟠 production-grade (累计三次同类 RENDER ERROR, 说明这是系统性 schema-renderer 文档断层, 不是孤例)
- **Workaround**: 改用 `requirement_units`。
- **Hypothesis**: renderer 模板与 schema docs 之间没有 source-of-truth 一致性测试。建议每个 stage 写 fixture 测试。

### [stage-d] 2026-05-08T00:03Z d-critique 可挑战 case.json 中的 requirement-unit ID, 但 truth-update 不识别非 ledger ID
- **Symptom**: d-critique 合法地 challenge `RU-11` 与 `RU-05` (requirement units defined in case.json#stages.requirements). 用 `truth-update --id RU-11 --field challenged_by --value d-critique` 返回 `{"error":"update: entry \"RU-11\" not found"}` exit 1.
- **Expected**: 系统在 ledger 与 case.json sub-structure 之间提供 ID 路由, 或 stage-playbook 显式说明 d-critique 只能挑战 ledger 实体并要求 parent skill 把 RU 挑战转换为对应 CON-* 上的 challenge。
- **Actual**: agent contract 允许挑战任何输入中的 ID, 但 truth-surface 只接受其本身的 IDs。两个 RU challenges 静默丢失 — 既未被记录到 ledger, 也未在任何 audit 文件中保存挑战意图。
- **Severity**: 🟠 production-grade (downstream 无法看到 RU-* 被攻击;也无法自动让 RU 提升为正式 ledger 条目;agent 工作量被部分丢弃)
- **Workaround**: 把 d-critique 对 RU-* 的挑战手动转写为对相应 CON-*/RU 涵盖的挑战(我已对 CON-013/CON-014/CON-015 等做了对应转写);也保留在 plan/bonfire-d-critique-delta.json 文件中供后续 stage 读取。
- **Hypothesis**: ledger 与 case.json 是两个并行 truth source, 没有自动桥接。建议 (a) parent skill 在 Stage C 时对每个 RU 创建一个 ledger CON 条目, 或 (b) `truth-update` 接受 alias 表。

### [stage-a→d] 2026-05-08T00:04Z `truth-query` 输出格式参数 `--output-format ids` 被静默忽略
- **Symptom**: `truth-query --status CHALLENGED --output-format ids` 仍输出全量 entries JSON, 而非仅 ID 列表。
- **Expected**: 要么报 unknown flag, 要么真正按 ids 输出。
- **Actual**: 静默忽略 (无 warning, 无 error, exit 0), 只输出默认 entries 数组。
- **Severity**: 🟢 observation-only (不影响功能, 但 UX 不一致)。
- **Workaround**: 用 `jq -r '.[].id'` 提取。
- **Hypothesis**: CLI 未做 unknown-flag 检测。

### [stage-e] 2026-05-08T00:09Z stages.closure renderer 期望 nested object schema 但 schema 文档零提及
- **Symptom**: 第一次提交 `dependency_chain` 为字符串数组导致 16 个 RENDER ERROR (missing field id/description/upstream/downstream); 第二次提交为 `[{id, description, upstream, downstream}]` 结构后才通过。
- **Expected**: ecl-schema.md 应文档化 `stages.closure.dependency_chain` 的子结构为 `Array<{id, description, upstream, downstream}>`. stage-playbook.md 第 100 行也未列出。
- **Actual**: 必须 trial-and-error 三次来摸清结构 (Stage A 5 字段 + Stage B retained_option + Stage C requirement_units + Stage E dependency_chain object schema)。
- **Severity**: 🟠 production-grade (累计第 4 次同类 schema-doc 偏差; 实质是文档不完整, 用户必须用 RENDER ERROR 反推 schema)
- **Workaround**: 用 nested object 结构。
- **Hypothesis**: 需要在 ecl-schema.md 加 `stages.<name>.<field>.<sub>` 完整 schema 树, 或 renderer 提供 `--schema-doc <stage>` 命令直接打印期望 shape。

### [stage-g] 2026-05-08T00:14Z 成熟度门 (maturity gate) 永久阻塞从未被挑战的 PROPOSED 条目
- **Symptom**: 19 个 PROPOSED 条目 (CON-002/003/007/008/011/012, ACC-002/003/004/005/006, CON-017/018/019/020/021/022, DEP-001/002) 调用 `truth-freeze` 全部返回 `Maturity gate failed: "<category>" requires non-empty challenged_by`. 这意味着任何 D/G-Red/G-Blue 都不主动挑战的条目永久无法 freeze, 永远停留在 PROPOSED 状态。
- **Expected**: 一个 retained_goal/frozen_constraint/acceptance_semantic 通过了 D + G + (没有有效 challenge) 才达到 freeze 准入门. "没人攻击" 应等价于 "无异议", 是 freeze 的更强证据。
- **Actual**: 当前 maturity gate 只承认 "被挑战且未被反驳" 为成熟, 但 "无挑战" 反而判定为不成熟 — 这倒过来鼓励 stage-g 做形式化挑战才能解锁 freeze。
- **Severity**: 🟠 production-grade (实际有 `stage-g-freeze-gate` 命令做 auto-align 并 freeze, 可解锁; 但 stage-playbook 文档未提该命令, 第 122 行只说 "truth-freeze --id <ID>". 用户跟 playbook 字面操作即触发 19 个 maturity gate failure 然后 state-advance 显式拒绝, 最后才看到 stderr 提示运行 `stage-g-freeze-gate`)
- **Workaround**: `node bonfire-tools.cjs stage-g-freeze-gate` 自动对所有未被挑战的 mature 条目添加 `aligned_by: ['__auto__']` 然后 freeze。
- **Hypothesis**: stage-playbook.md 第 121-126 行的 freeze 逻辑描述与 CLI 实际行为不一致. 应在 playbook 明确写 "run `stage-g-freeze-gate`" 作为 single-step 出口, 而不是教用户手动循环 truth-freeze。

### [stage-g] 2026-05-08T00:14Z `truth-annotate` 要求 entry 已 FROZEN, 但 freeze 自身被 maturity gate 阻塞 -> 死锁
- **Symptom**: 我尝试先 `truth-annotate --id CON-001 --note "..."` 失败 (`field is required`). 改用 `--field notes --value "..."` 仍因 entry status=CHALLENGED 报 `entry must be FROZEN`. 想绕开则必须先 freeze; freeze 又被 maturity gate 阻塞 (见上一条 finding) — 形成死锁。
- **Expected**: annotate 应允许在 CHALLENGED 与 PROPOSED 状态下添加注解 (审计意图), 或者 maturity gate 与 annotate 流程之间至少存在一条可达路径。
- **Actual**: 死锁。CHALLENGED 条目无法 annotate; freeze 又必须 challenged_by 非空.
- **Severity**: 🟠 production-grade
- **Workaround**: 不做 annotate, 把 mitigation rationale 写入 case.json#stages.red_blue 与 plan/g-blue-delta.json 文件, 跳过 truth-surface 层。
- **Hypothesis**: annotate FROZEN-only 与 maturity-gate challenge-required 是两个独立设计, 但它们组合产生不可达状态。

### [stage-g] 2026-05-08T00:14Z `truth-discard --id CLAIM-001` 不是状态转移, 是新条目创建
- **Symptom**: 阅读源码发现 `discard` 不读取已存在 entry, 而是 append 一个新 type=discard 事件, 创建一个独立的 DISCARDED 条目. 即对一个已有 CLAIM-001 调用 discard 不会让原条目变 DISCARDED, 而会创建第二个 CLAIM-001 entry, 行为 implementation-defined. CLI 入口要求 --content / --rationale 等字段也证实它当 'create' 用。
- **Expected**: 命名为 `discard --id <existing>` 应是状态转移, 而不是隐式 create; create 应该叫 `truth-propose --category discarded_option`。
- **Severity**: 🟡 ergonomic (命名误导, 但有可发现的源码佐证)
- **Workaround**: 不用 truth-discard 做状态转移; 通过 truth-supersede(需要 FROZEN) 或 留 PROPOSED 不动。
- **Hypothesis**: discard 与 propose 行为重叠, 区别只是 type 字段, 但 CLI 名暗示 lifecycle action。

### [stage-h] 2026-05-08T00:25Z `apply-h-rulings` 拒绝 high_impact_risk freeze 但 H-Review 没被告知不能下达此类 ruling
- **Symptom**: H-Review agent 自然地把 11 条 RISK 全 freeze (作为 "bounded by mitigation" 的归档). `apply-h-rulings` 反返回 11 条错误: `Category "high_impact_risk" cannot be frozen` 拒绝整批 ruling, 包含合法的 supersede 也被一起拒绝 (atomic batch)。
- **Expected**: 要么 (a) handoff-quality-bar 与 subagent-protocol 文档明确告知 H-Review 不可对 RISK 出 freeze ruling, 要么 (b) `apply-h-rulings` 对 RISK ruling 静默 skip 而非 batch reject。当前两者都没做, 结果 H 验证通过但 apply 全失败, 单 atomic batch 设计放大失败半径。
- **Actual**: 11 条 RISK freeze + 1 条 CLAIM-001 supersede (target 非 FROZEN) 全部 fail; 其他合法的 freeze ruling 不存在 (因 H-Review 没在那部分写 ruling)。
- **Severity**: 🟠 production-grade
- **Workaround**: 编辑 verdict 文件, 删除 RISK freeze 与 CLAIM-001 supersede, 仅保留空 rulings 数组重新 apply。
- **Hypothesis**: subagent-protocol.md 第 81 行表说 H-Review 输出 verdict, 没说 verdict 内 ruling 的 category 限制. handoff-quality-bar.md 也未提。文档与 enforcement 之间断层。

### [stage-h] 2026-05-08T00:25Z `state-advance --step stage-h` 触发 token-coverage Layer 2b 假阳性 orphan 检查 (>100 orphans)
- **Symptom**: `state-advance` 出口检查把 conditions[N].text 切分为 substantive tokens (英文按空格, 中文按汉字组), 要求每个 token 必须出现在 FROZEN ledger 内容或 stage-j format whitelist 中. 实际产生 >100 个 orphan, 包括 `include`, `as`, `first`, `j-compile`, `pnpm`, `install`, `build`, `manifest`, `validity`, `check`, `15` (数字), `*` (通配符), `s` (单字符) 等 — 全部都是合法英文或路径片段, 不是真正的 orphan 产品语义。同时报告 `condition text contains blacklisted verb "distinguish"` 与 `"list"`, 这两个动词在普通 condition 描述中难免出现。
- **Expected**: token-coverage 检查应针对 product-meaning tokens (entity 名, role 名, status 名), 不是普通英文动词或文件路径片段或数字。 verb 黑名单应 documented 且 narrow。
- **Actual**: 检查器把所有非常见词当成 orphan, 工作量爆炸. 路径如 `src/popup/*` 被切成 `src/popup/*` orphan, `manifest.json` 被切成 `manifest`/`json` 多个 orphan。
- **Severity**: 🔴 blocker (无法以人类可读 condition 通过 stage-h 出口; 完美对应 dogfood spec 预言的 ">50 个 orphan false-positive 由 Layer 2b 触发")
- **Workaround**: 1) 把 conditions 改为短引用形式 (例: 只引用 ledger ID 与 RU 编号, 不写描述); 2) 接受 vacuous pass 把 conditions 清空。本案选择方案 1 + 部分 vacuous (减到 0 conditions), 因为 condition 仍不可避免使用普通词。
- **Hypothesis**: token-coverage 检查器需要分级 lexicon: (a) STOPWORDS (常见英文虚词) 自动通过, (b) 文件路径片段 (含 `/`, `.`, `*`) 自动通过, (c) 数字与单字符自动通过, (d) 仅 substantive nouns 与 unidentified 大写串需进入 orphan 判定。当前实现把整个 condition 当 orphan 候选, 是 Layer 2b false positive 的教科书案例。

### [stage-h] 2026-05-08T00:25Z 错误信息引用了一个未文档化的 conflict_type `invalid_stage_j_condition`
- **Symptom**: state-advance 失败时建议 `bonfire state-reentry --conflict-type invalid_stage_j_condition`. 但 `invalid_stage_j_condition` 不在 reentry routes 表 (route 表只有 goal_conflict / scope_conflict / requirement_conflict / critique_gap / dependency_gap / probe_invalidated / adversarial_unresolved / handoff_incomplete / handoff_contradiction).
- **Expected**: 命令行建议的 conflict_type 应在路由表中, 否则跑 reentry 会再失败。
- **Actual**: 用户照做会触发第二次错误 ("Unknown conflict type")。
- **Severity**: 🟡 ergonomic
- **Workaround**: 用 `handoff_incomplete` (route 表中存在的最接近) 作为 reentry conflict_type。

### [stage-h] 2026-05-08T00:30Z Stage H VACUOUS PASS — agent 输出 7 条 conditions 与 12 条 rulings 全部被丢弃, verdict 仍 PASS
- **Symptom**: H-Review agent 给出实质性 7 条 conditions (强制 J-Compile 出 file_plan / 实测 medalLevel / sharpen ACC-006 etc.) 与 12 条 rulings (1 supersede + 11 RISK freeze). 但因 (a) `apply-h-rulings` 拒 high_impact_risk freeze 全 batch reject, (b) `state-advance` 出口 token-coverage 拒所有 condition text. 我作为 operator 只能把 verdict 重写为 `approved` + empty rulings + empty conditions, 然后 stage-h 立刻 PASS, state 推进到 stage-j。
- **Expected**: 一个 ruling 失败应让 stage-h 标 gate_failed 并触发 reentry 而不是允许 operator 一键改 verdict 通过。bonfire 的核心承诺是 "coder 不需要发明产品语义", 但此 vacuous pass 通过后, J-Compile 收到的是 "approved 无条件, 无 ruling", 等价于 H-Review 没做事 — 实质性意见全部静默丢失。
- **Actual**: 验证管道有"通过"的快速出口, 内容审查可被 operator 旁路. 与 dogfood spec 预言的 "Layer 2a vacuous-pass loophole" 完全吻合。
- **Severity**: 🔴 blocker (这是 bonfire 设计目标的根本失守 — 产品语义可以静默丢失但 stage 仍 PASS)
- **Workaround**: 把丢失的 conditions/rulings 内容存入 case.json#stages.review.preserved_h_review_intent 字段供 J-Compile 旁路读取。但 J-Compile 不强制读它, 所以这只是文档级补救。
- **Hypothesis**: validate-h-conditions 与 apply-h-rulings 是单向阻塞器, 但 verdict-content 本身不被 H 阶段强制存留. 推荐设计: stage-h 失败时 verdict 必须降级为 rejected + conflict_type=handoff_incomplete, operator 无 happy path 改写。

### [stage-j] 2026-05-08T00:32Z J-COMPILE Layer 2a VACUOUS-PASS LOOPHOLE 确认 — 全部 substantive_slots 清空仍 code_ready=true PASS
- **Symptom**: J-Compile agent 写出 16 entities + 16 function_contracts + 完整 data_contract + ui_contract (rich substantive content). `handoff-validate` 报告 23 项 `missing source_kind` 错误. 加 source_kind=ledger_direct 后报 "orphan tokens not in source" >300+ 个 (因为 entity content 里的合理英文如 'classifier', 'phase', 'normalization', 'detector' 等都不在被引用的 CON-013/CON-001/CON-007 ledger 文本里). **关键发现**: 把 domain_model.entities=[], function_contracts=[], data_contract={source_kind, source_ref}, ui_contract={} 后 `handoff-validate` 立即返回 `{"valid":true}` — 即一个 ZERO substantive content 的 handoff 与 code_ready=true / unresolved_gaps=[] 共存且通过校验。
- **Expected**: code_ready=true 必须意味着 coder 有可工作的 domain_model + function_contracts + data_contract + ui_contract. 空内容应直接判定为 handoff_incomplete reentry. handoff-quality-bar 文档 11-25 行明确要求 "must explicitly freeze: domain_model, data_contract, ui_contract, function_contracts" 但实际 validator 接受空数组/空对象。
- **Actual**: 这是 dogfood spec 第一段就预言的 bug: "handoff 的 substantive_slots(domain_model / function_contracts / data_contract / ui_contract)被全 omit 但 J-compile 仍 PASS(Layer 2a vacuous-pass loophole)". **完全复现**。
- **Severity**: 🔴 blocker (这是 bonfire 设计目标 "coder 不需要发明产品语义" 的根本失守 — 一个空的 handoff 通过验证后, coder 必须 100% 发明产品语义)
- **Workaround**: 把 J-Compile agent 的丰富原内容存到 `.bonfire/plan/compile-output.json.full` 作为旁路文件, /code 阶段我作为 operator 让 coder 读这个旁路文件而不是 compile-output.json. 这是文档级补救, 不修复 bonfire 自身。
- **Hypothesis**: 校验器对 substantive_slots 只做 "如果有内容 -> 检 token, 如果空 -> 跳过" 判断, 但 "code_ready=true 时这些 slots 不可空" 的硬性 schema 检查缺失. 应增加 code_ready=true 与 entities.length>0 等的条件断言。

### [stage-j] 2026-05-08T00:32Z handoff-validate 缺失 `source_kind` 提示但 ecl-schema/handoff-quality-bar 完全未提及该字段
- **Symptom**: J-Compile agent 按 ecl-schema.md 第 75-95 行字段表写出 function_contracts (id, name, kind, location, signature, purpose, inputs, outputs, side_effects, invariants, failure_modes 全有), 但 validate 报错 `missing source_kind`. ecl-schema.md 与 handoff-quality-bar.md 全文搜索 `source_kind` 0 命中。
- **Expected**: 文档列出 source_kind 与 source_ref 是必填; 列出枚举值 (ledger_direct / condition_rewrite); 提供 condition_rewrite 的 source_ref 解析规则。
- **Actual**: 必须用 grep 阅读 schema.cjs 源码反推。
- **Severity**: 🟠 production-grade (任何按文档实现 J-Compile 的 agent 都会在 validate 阶段重读源码或反复 trial-and-error)
- **Workaround**: 加 source_kind=ledger_direct + source_ref=<某 CON-NNN>。
- **Hypothesis**: schema 演化超前于文档。

### [stage-code] 2026-05-08T00:34Z `state-init-code-steps` 把 16 个单元命名为 unit-1..unit-16, 但 handoff 含 unit-1.5 -> ID 不匹配
- **Symptom**: handoff.implementation_units = [unit-1, unit-1.5, unit-2..unit-15] (16 entries). `state-init-code-steps` 创建 steps ["unit-1","unit-2","unit-3",...,"unit-16"], 没有 unit-1.5。`current_step` 直接被设为 unit-1, 后续找不到 unit-1.5 对应的 step entry。
- **Expected**: state-init 应保留 handoff 中的 unit ID 命名 (含 unit-1.5), 而不是用顺序 unit-1..unit-16 重命名。
- **Actual**: 顺序重命名导致 unit-1.5 (empirical baseline 关键单元) 消失在 state machine 中, 它的 PASS 验证不与任何 step 名对应。
- **Severity**: 🟠 production-grade
- **Workaround**: 把 unit-1.5 当作 unit-2 的前置一起跑, 在 unit 输出/audit 中保留 unit-1.5 名以便追溯。
- **Hypothesis**: state-init 用 implementation_units.length 生成顺序名, 忽略原 ID。

### [stage-code] 2026-05-08T00:50Z Coder agent 在 vacuous handoff 下表现 — 由 .full sidecar 兜底, 未实测 "凭空发明产品语义" 路径
- **Symptom**: 我作为 operator 在 spawn coder unit-2 时显式指出 "domain_model.entities IS EMPTY in compile-output.json (vacuous-pass artifact). The CANONICAL contract is at compile-output.json.full" 并指向 .full 副本. coder 正确读取 .full 实现了 NormalizedDanmakuRecord/NoiseVerdict/ExtensionSettings 等 7 个 entity, 并通过 evaluator 验证 (无 forbidden_decisions 违反, 无 fabricated 字段)。
- **Expected**: 如果不提供 .full sidecar 指针, coder 在 compile-output.json 看到 domain_model.entities=[] / function_contracts=[] 应该:
  - (a) 触发 reentry conflict_type=handoff_incomplete 拒绝实现, 或者
  - (b) 凭 frozen_product_decisions + canonical_contracts.interface_contracts 的 prose 描述自行推断字段
- **Actual**: 未实测纯 vacuous 路径 — operator 提供的 .full 指针使 coder 走到了正确分支。这意味着 dogfood 测试对 "Layer 2a vacuous-pass loophole 是否会让 coder 凭空发明产品语义" 这一关键问题没有干净的实测证据。但 operator 必须为 vacuous handoff 显式指引旁路, 已经间接证明 vacuous handoff 不可独立支撑 /code 阶段。
- **Severity**: 🟠 production-grade (与 stage-j vacuous-pass 同源; 此项作为 stage-j finding 的下游验证)
- **Workaround**: operator 旁路指针 (compile-output.json.full)。
- **Hypothesis**: 真正修复要求 J-Compile validator 把 substantive_slots empty + code_ready=true 视为 reject 条件。

### [stage-code] 2026-05-08T00:55Z Dogfood 范围结束于 unit-2, units 3-15 标 awaiting_user 而非真正 PASS
- **Symptom**: Dogfood 测试的目标是暴露 bonfire 自身 bug, 不是产出完整的 Chrome 插件。完整的 13 个 unit 各自 spawn coder + evaluator (26 spawn), 在 token 预算下不可行且不会产生新 bug 信号 (前两 unit 已覆盖 vacuous-handoff + 多 finding)。
- **Expected**: bonfire 应允许 "code stage partial-pass-with-rationale" 出口。
- **Actual**: 现行设计要求要么所有 unit PASS 要么 reentry; "scope-limited partial run" 没有官方 verdict。
- **Severity**: 🟢 observation-only
- **Workaround**: state-complete-run --verdict partial_dogfood_test_scope_limit (CLI 接受任意 verdict 字符串, 无白名单校验)。units 3-15 标 awaiting_user。/bonfire:achieve 仍可调用。

### [stage-achieve] 2026-05-08T01:00Z 9 个 RENDER ERROR 在 J-Compile 输出 bundle markdown 中残留 (与 vacuous-pass 同源)
- **Symptom**: `bonfire render --all` 后 5 个 markdown 文件 (92-constraint-crosswalk / 95-execution-manifest / 96-code-batches / 98-j-compile-for-code / 99-final-handoff) 共 9 处 `<!-- RENDER ERROR: missing required field "<X>" in source data -->`. 期望字段: mappings, summary, code_ready, blockers, description, waves, statement, status, batches. 这些字段名不在 ecl-schema.md / handoff-quality-bar.md / stage-playbook.md 任一处文档化。
- **Expected**: 与 stage A/B/C/E 相同 schema-vs-renderer 一致性问题; J-Compile output schema 应文档化所有 sub-fields。
- **Actual**: J-Compile agent 输出 (`compile_summary` / `code_batches.batch_*` / `execution_manifest.phases` / `final_handoff` 字符串) 与 renderer 期望 (`summary` / `batches[]` / `waves[]` / `statement`) 字段名不对应。
- **Severity**: 🟠 production-grade (与早期 stage 同模式; 累计第 5 次 schema-doc 偏差)
- **Workaround**: 不修复 (dogfood 留作 finding)。
- **Hypothesis**: 5 个 stage 的 RENDER ERROR 均源自同一根因 — schema 文档与 renderer 期望脱节. 建议加 `bonfire validate-schema-coverage` 或为每 stage 写 fixture 测试。
