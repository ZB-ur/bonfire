# Bonfire

让 AI 在合约下写代码，而不是猜你想要什么。

[![tests](https://img.shields.io/badge/tests-321%20passing-brightgreen)](#开发)
[![node](https://img.shields.io/badge/node-22%2B-blue)](#前置要求)
[![license](https://img.shields.io/badge/license-MIT-lightgrey)](#license)
[![status](https://img.shields.io/badge/status-0.1.0%20%C2%B7%20dogfood--validated-orange)](#成熟度)

Bonfire 解决的核心问题：AI 在编码过程中会静默做出大量产品决策（数据模型、边界处理、API 风格……），这些决策从不经过审查，也无法追溯。Bonfire 通过**对抗性规划**和**冻结合约**，把高影响决策锁定在规划阶段，编码阶段只负责执行。

---

## 目录

- [快速开始](#快速开始)
- [什么时候该用 Bonfire](#什么时候该用-bonfire)
- [核心理念](#核心理念)
- [Pipeline 概览](#pipeline-概览)
- [阶段参考](#阶段参考)
- [约束账本](#约束账本)
- [H→J 三层校验](#hj-三层校验)
- [回退路由](#回退路由)
- [项目结构](#项目结构)
- [`.bonfire/` 目录布局](#bonfire-目录布局)
- [开发](#开发)
- [故障排查](#故障排查)
- [成熟度](#成熟度)
- [为什么需要 Bonfire](#为什么需要-bonfire)
- [参考文献](#参考文献)

---

## 快速开始

### 前置要求

- **Node.js 22+**
- **Claude Code**（需要有效订阅）

### 安装

```bash
git clone https://github.com/ZB-ur/bonfire.git
cd bonfire
bash install.sh
```

安装脚本会：
- 把 `bin/`、`skills/`、`agents/`、`references/`、`schemas/`、`templates/`、`hooks/` 复制到 `~/.claude/bonfire/`
- 在 `~/.claude/settings.json` 注册 `PostToolUse` dual-write hook（JSON 写入自动渲染对应 markdown）
- 注册 `.claude-plugin/plugin.json` 作为 Claude Code 插件清单

### 使用

在任意项目目录中启动 Claude Code：

```
/bonfire:pre     # 初始化案例，提取意图，人工审批
/bonfire:plan    # 对抗性规划（生成方案 → 攻击缺陷 → 红蓝对抗 → 冻结合约）
/bonfire:code    # 按冻结合约逐单元编码
/bonfire:achieve # 验收闭环
/bonfire:render  # 手动渲染 markdown 文档（dual-write hook 通常会自动完成）
```

### 卸载

```bash
cd bonfire
bash uninstall.sh
```

卸载脚本只移除 `~/.claude/bonfire/` 和 settings.json 中的 hook 注册，不会触碰任何项目下的 `.bonfire/` 数据目录。

---

## 什么时候该用 Bonfire

**适合**

- 需求复杂、涉及多个模块的实现任务
- 跨多个 session 的大型开发
- 需要多人（或多 agent）协作且决策需要可追溯的场景
- 你已经被 AI "看起来跑通了但打开是空白"伤过

**不适合**

- 一行 bug fix
- 快速原型探索
- 简单脚本任务

——这些场景 Bonfire 的流程开销大于收益，直接让 Claude Code 写就行。

---

## 核心理念

**规划拥有语义，编码只拥有执行。**

### 约束账本（Truth Surface）

每个产品决策都记录在共享的约束账本中，有明确的生命周期：**提出 → 挑战 → 冻结**。账本跨会话、跨 agent 共享，不依赖任何人的记忆力——包括 AI 的。

没有共享的事实来源，每个 agent 各自理解需求，结果就是各自偏各自的。

### 对抗性审查

AI 不会主动质疑你的方向。它会配合地在错误的路上陪你走很远。

Bonfire 用独立的 subagent 从不同角度审查同一份规划：D-Critique 攻击需求缺陷、G-Red 找漏洞、G-Blue 提防御方案、H-Review 终审裁决。规划在对抗中存活下来，实现时翻车的概率就低得多。

### 阶段门控

每个阶段的输出必须通过验证才能进入下一阶段。所有提出的约束要么被冻结、要么被显式拒绝——**不允许"忘记处理"**。质量校验前移，不是写完代码才发现方向错了。

### 冻结合约（Frozen Handoff）

编码阶段的唯一输入，不是参考文档，是合约。哪些决策已做出、哪些边界不可逾越、哪些低影响选择留给编码者，全部写死。遇到合约未覆盖的高影响决策？**不能自己做主**，触发回退（reentry）重新规划。

---

## Pipeline 概览

```
┌──────────┐     ┌──────────────────────────────┐
│  Pre     │────▶│  约束账本（Truth Surface）    │
│  意图提取 │     │                              │
└──────────┘     │  共享的、可冻结的决策记录      │
                 │  提出 → 挑战 → 冻结           │
                 └──────┬───────────┬────────────┘
                        │           │
              ┌─────────▼───┐  ┌────▼──────────┐
              │  Plan       │  │  Code          │
              │  对抗性规划  │  │  合约驱动编码  │
              │             │──▶│               │
              │  B→C→D→E→F  │  │  逐单元实现     │
              │  →G→H→J     │  │  禁止发明决策   │
              │  冻结合约    │  │                │
              └──────┬──────┘  └────┬──────────┘
                     │              │
                     │  reentry ◀───┘
                     │
              ┌──────▼──────┐
              │  Achieve    │
              │  验收闭环    │
              └─────────────┘
```

---

## 阶段参考

Plan pipeline 由 8 个阶段构成。每个阶段都有明确的入口门、产物和退出门——`bonfire state-advance --step <stage>` 会在前后强制不变量检查，门没过就拒绝推进。

| 阶段 | 名称 | 角色 | 主要产物 | 退出门 |
|:---:|---|---|---|---|
| **A** | Preprocess | 把原始请求 → 已审批的规划目标 | `case.json#stages.preprocess`，`confirmed_fact` 冻结条目 | 用户显式批准 approval pack |
| **B** | Divergence | ≥3 个实质不同方案，选 1 条保留路径 | `case.json#stages.divergence` | 已选定 retained_option，理由完整 |
| **C** | Requirements | 把保留路径分解为可验证的需求单元 | `case.json#stages.requirements`，`frozen_constraint` 提案 | 每个 unit 有 success_criteria |
| **D** | Critique | `bonfire-d-critique` 独立攻击需求 | `bonfire-d-critique-delta.json` | delta 通过 schema 校验，≥1 challenge 进入账本 |
| **E** | Closure | 闭合依赖链，避免孤立约束 | `case.json#stages.closure` | 所有 dependency_chain 引用有效 |
| **F** | Probes | 实测脚本/环境/关键假设 | `case.json#stages.probes` | 每个 probe 有结果（成功或不可执行） |
| **G** | Red-Blue | G-Red 攻击、G-Blue 防御，冻结幸存者 | `bonfire-g-red-delta.json`, `bonfire-g-blue-delta.json` | `stage-g-freeze-gate` 退出 0：无 unresolved CHALLENGED |
| **H** | Review | `bonfire-h-review` 终审：approved / approved_with_conditions / rejected | `h-review-verdict.json` | Layer 1 通过；`apply-h-rulings` 成功 |
| **J** | Compile | `bonfire-j-compile` 编译冻结合约 | `compile-output.json` | `handoff-validate` Layer 2a/2b 通过；`code_ready=true` |

完整阶段 playbook 见 `references/stage-playbook.md`，schema 契约见 `references/ecl-schema.md`，质量门标准见 `references/handoff-quality-bar.md`。

---

## 约束账本

账本是 Bonfire 的"参考信号"（reference signal）——所有产品决策的事实来源。位于 `.bonfire/truth-surface/`，由 `constraint-ledger-snapshot.json`（当前快照）和 `constraint-ledger-history.jsonl`（追加事件日志）组成。

### 8 个条目类别

| 类别 | 可冻结 | 初始状态 | 成熟门 | 典型用途 |
|---|:---:|---|---|---|
| `retained_goal` | ✓ | PROPOSED | challenged_or_aligned | Stage A 批准的高层目标 |
| `confirmed_fact` | ✓ | PROPOSED | (informational) | 已验证的仓库/环境事实，Stage A 自动冻结 |
| `frozen_constraint` | ✓ | PROPOSED | challenged_or_aligned | 技术约束（Stage C 起） |
| `challenged_claim` | ✗ | PROPOSED | — | 用户声明但未验证；保留至重新分类 |
| `discarded_option` | ✗ | DISCARDED | — | 显式拒绝的选项 |
| `high_impact_risk` | ✗ | OPEN | — | 无法消解的残余风险；永久 OPEN |
| `dependency_chain` | ✓ | PROPOSED | refs_valid | 内外部依赖；引用需有效 |
| `acceptance_semantic` | ✓ | PROPOSED | challenged_or_aligned | 验收语义；编码前必冻结 |

### 状态生命周期

```
PROPOSED ──challenge──▶ CHALLENGED ──align──▶ FROZEN
   │                                            ▲
   └──────── stage-g auto-align ────────────────┘
   
PROPOSED / CHALLENGED ──supersede──▶ SUPERSEDED
PROPOSED / CHALLENGED ──discard────▶ DISCARDED
```

- **`can_freeze=false`** 的类别永远停留在终态（OPEN / CHALLENGED / DISCARDED），不允许调用 `truth-freeze`
- **`aligned_by`** 数组记录辩护来源；可以是 agent 名（`stage-g-blue`）或特殊 token（`stage-g-survival`、`stage-h-ruling`）
- **`stage-g-freeze-gate`** 自动冻结所有 PROPOSED 且未受挑战的条目（注入 `stage-g-survival`），并阻止任何残留 unresolved CHALLENGED 推进
- **`lexicon_exempt: true`**（per-condition opt-in）可让条目跳过 Layer 1 跨语言 token 检查——用于 CJK / Arabic / Cyrillic / 专名 / 商标 / 技术 ID

---

## H→J 三层校验

Stage H（终审）到 Stage J（编译合约）之间的"接缝"是整个系统最危险的地方——这里一旦放过含糊条件或缺源内容，就会污染冻结合约。Bonfire 在这里架了三层防线：

| 层 | 位置 | 检查内容 |
|---|---|---|
| **Layer 1** | `bin/lib/seam-validation.cjs` → `validateHConditions` | 每条 condition 的文本：① 黑名单动词（enumerate / classify / define / specify / list 等 30+）② 释义模式（"for each X produce…"）③ 孤立 substantive token（必须出现在 FROZEN 账本、whitelist 或 handoff schema 词表中） |
| **Layer 2a** | `bin/lib/schema.cjs` → `validateProvenance` | handoff 中所有 substantive slot 必须携带 `source_kind ∈ {ledger_direct, condition_rewrite}` 和 `source_ref`：ledger_direct 指向 FROZEN 条目 id；condition_rewrite 指向 verdict.conditions 索引 |
| **Layer 2b** | `bin/lib/schema.cjs` → `validateHandoff` | handoff 每个 substantive token 必须有来源覆盖（FROZEN 账本 content + id、whitelist、schema 词表）。Round-4 校准引入 `max_contiguous_orphan_run` 度量，阈值 30 = round(p75=25 × 1.20)，把 PR #2 的二元拒绝改为分布感知 |

**反目标**：H-Review 不能用 `approved_with_conditions` 作为对未解决产品语义缺口的妥协。conditions 只能引导 J-Compile 重写已有源，不能让它"枚举""分类""定义"——那叫规划没做完。

---

## 回退路由

编码或后期阶段发现冻结合约不覆盖某个高影响决策时，**不能自由发挥**——必须触发 reentry，回到能修这个缺口的规划阶段。这是 Bonfire 的 algedonic signal：偏差产生信号，信号驱动纠偏。

| `conflict_type` | 目标阶段 | 触发场景 |
|---|---|---|
| `goal_conflict` | stage-a | 暴露目标层冲突；唯一跨 pipeline 的回退 |
| `scope_conflict` | stage-b | 保留路径不可行，需要重选 |
| `requirement_conflict` | stage-c | 需求单元缺失或矛盾 |
| `critique_gap` | stage-d | 关键攻击点没被审查 |
| `dependency_gap` | stage-e | 依赖未闭合 |
| `probe_invalidated` | stage-f | 实测假设被推翻 |
| `adversarial_unresolved` | stage-g | 红蓝对抗未收敛 |
| `handoff_incomplete` | stage-h | 终审遗漏 |
| `handoff_contradiction` | stage-j | 合约自身矛盾 |
| `invalid_stage_j_condition` | stage-h | Layer 1 拒收 |
| `handoff_provenance_failure` | stage-h | Layer 2a 拒收 |

`bonfire route --list` 列出全部路由；`bonfire state-reentry --conflict-type <type>` 写入 `state.json#pending_reentry`，下一次启动对应 skill 时会被自动消费。回退深度有上限，超阈值暂停并请求人工介入。

---

## 项目结构

```
bonfire/
├── skills/         5 个 skill（pre / plan / code / achieve / render）
├── agents/         10 个对抗性 subagent
├── references/     共享知识文档（schema、playbook、quality bar、whitelist）
├── schemas/        bonfire-v1.json — pipeline schema 单一事实源
├── templates/      22 个 markdown 渲染模板
├── hooks/          dual-write hook（JSON 写入 → 自动渲染 markdown）
├── bin/            CLI 工具入口（bonfire-tools.cjs + lib/*.cjs）
├── tests/          321 tests, 0 failures
├── docs/           设计文档（specs/、plans/、evidence/）
├── .claude-plugin/ plugin.json
├── install.sh
└── uninstall.sh
```

### 10 个 subagent

| Agent | 阶段 | 角色 |
|---|---|---|
| `bonfire-intent-extractor` | A | 推断字面请求之外的真实目标 |
| `bonfire-reality-checker` | A | 用仓库证据验证用户声明 |
| `bonfire-blind-spot-scout` | A | 识别未考虑维度 |
| `bonfire-d-critique` | D | 独立批判需求 |
| `bonfire-g-red` | G | 攻击保留路径 |
| `bonfire-g-blue` | G | 防御并提缓解 |
| `bonfire-h-review` | H | 终审 approved / conditions / rejected |
| `bonfire-j-compile` | J | 编译冻结合约 |
| `bonfire-coder` | code | 按 handoff 执行 |
| `bonfire-evaluator` | code | 单元验证 + algedonic 检查 |

---

## `.bonfire/` 目录布局

每个使用 Bonfire 的项目在自己根目录下生成 `.bonfire/`：

```
.bonfire/
├── case.json                              # 当前案例 — Stage A-F 状态汇总
├── state.json                             # 状态机 — 各 step status、pending_reentry
├── truth-surface/
│   ├── constraint-ledger-snapshot.json    # 账本当前快照
│   └── constraint-ledger-history.jsonl    # 追加事件日志（用于 truth-rebuild）
├── plan/
│   ├── bonfire-d-critique-delta.json
│   ├── bonfire-g-red-delta.json
│   ├── bonfire-g-blue-delta.json
│   ├── h-review-verdict.json
│   └── compile-output.json                # 冻结合约 — code 阶段唯一输入
├── runs/<run-id>/
│   ├── unit-<N>-manifest.json             # coder 产出
│   ├── unit-<N>-verdict.json              # evaluator 判定
│   ├── code-run.json
│   ├── verification.json
│   ├── reentry.json
│   └── achieve.json
├── bundle/                                # 自动渲染的 markdown（dual-write hook 产生）
│   ├── 00-overview.md
│   ├── 05-constraint-ledger.md
│   ├── 10-a-preprocess.md ... 80-h-review.md
│   ├── 90-code-handoff.md ... 99-final-handoff.md
├── logs/
│   ├── agent-invocations.jsonl
│   ├── state-transitions.jsonl
│   └── render.jsonl
└── archive/<date>-<title>/                # 验收后归档
```

所有 JSON 都是单一事实源；markdown 由模板自动渲染，绝不手编。

---

## 开发

```bash
# 运行全部测试
node --test tests/*.js

# CLI 帮助
node bin/bonfire-tools.cjs --help

# 在某个项目下初始化案例
node bin/bonfire-tools.cjs init --request "你的请求" --project-root /path/to/project

# 重放账本历史以重建快照
node bin/bonfire-tools.cjs truth-rebuild

# 检查渲染产物是否过期
node bin/bonfire-tools.cjs render-check
```

主要 CLI 命令组（完整列表见 `bin/bonfire-tools.cjs`）：

- **state** — `state-read` / `state-advance` / `state-reentry` / `state-step` / `state-begin-run` / `state-complete-run`
- **truth** — `truth-propose` / `truth-update` / `truth-annotate` / `truth-freeze` / `truth-supersede` / `truth-discard` / `truth-read` / `truth-query` / `truth-rebuild`
- **seam** — `delta-validate` / `handoff-validate` / `bundle-validate` / `validate-h-conditions`
- **freeze** — `stage-g-freeze-gate` / `apply-h-rulings`
- **render** — `render` / `render-check`
- **case** — `init` / `archive` / `archive-list`
- **log** — `log-agent` / `log-transition` / `log-read`
- **other** — `route` / `preflight-update`

---

## 故障排查

**Q: `state-advance` 退出非 0，提示 "unresolved CHALLENGED entries"**
A: Stage G 还有挑战未被防御。运行 `bonfire truth-query --status CHALLENGED` 看哪些 id，要么用 `truth-update --field aligned_by` 补齐辩护，要么 `truth-discard` 撤回，或者回到 `/bonfire:plan --from stage-g` 重跑红蓝。

**Q: `handoff-validate` 报 "orphan tokens"**
A: J-Compile 写出了账本和 whitelist 都没有的 substantive token。检查 token 是否对应一条 FROZEN 条目；如果是合法外来词（CJK / 专名 / 技术 ID），在相关 condition 上加 `lexicon_exempt: true` 或追加到 `references/stage-j-format-whitelist.md`。

**Q: `validate-h-conditions` 报 "blacklisted verb"**
A: H-Review 在 condition 里用了 `enumerate / classify / define` 等动词——这意味着把规划工作推给了 J-Compile。把这条 condition 重写为已有源的指向，或者回退到能生成该约束的更早阶段。

**Q: dual-write hook 没自动渲染**
A: 确认 `~/.claude/settings.json` 包含 `hooks.PostToolUse` 下的 bonfire 条目；超时默认 10s。手动补救：`bonfire render --all`。

**Q: 想从某个旧 run 恢复**
A: `.bonfire/archive/` 保留所有归档案例。`.bonfire/truth-surface/constraint-ledger-history.jsonl` 是追加日志，`bonfire truth-rebuild` 可以从历史完全重建快照。

---

## 成熟度

Bonfire 当前版本 **0.1.0**，已通过两轮 dogfood 实战验证：

- **2026-05-04** — gto-trainer 项目，20 findings → 收口至 0
- **2026-05-08** — bilibili-danmaku-denoiser 项目，27 findings → 13 条已收口（其余归档为未来 assertion 候选）

PR #2 + #3 合计关闭 4 个 Assertion + 1 Round + F1 跨语言修正。下一轮（第 3 次 dogfood）预定针对当前 main HEAD 派发。

**已知未关闭**（不阻塞使用，但请知悉）：

- Agent-dispatch fail-loud 纪律——d-critique / g-red / g-blue delta 中 target id 不在账本时，挑战意图会从审计轨迹静默丢失（3d-candidate）
- `stage_schemas` 仅声明式，未做运行时强制
- `unit.id` Unicode 与碰撞检测缺失
- Lemmatizer `-ed` 非对称（`learned → learne` 被 whitelist 掩盖）

---

## 为什么需要 Bonfire

AI 编码工具经历了两代架构，各有天花板：

**第一代：人工驱动** — 用户写需求，AI 生成代码，人工审查。问题不是代码质量，而是 AI 在编码过程中静默做了大量产品决策（数据模型、边界处理、API 风格），这些决策从不经过审查。你无法区分"AI 正确理解了需求"和"AI 自信地误解了需求"，直到打开应用才发现。没有反馈回路。

**第二代：流水线驱动** — 多个 agent 组成 pipeline，分工协作。本质上仍然是开环的：agent 之间的理解偏差单向传播、逐级放大，没有共享的事实来源，没有纠偏机制。我们的 [Mosaicat](https://github.com/ZB-ur/mosaicat) 就是这么翻的：13 agent pipeline 跑完全绿，打开应用一片空白。

两代的共同问题：

1. **决策在错误的层级发生**（编码阶段而非规划阶段）
2. **认知没有持久化为硬约束**（每次 agent 调用都从零理解）
3. **验证停留在表面**（编译通过不等于能用）

Bonfire 的回应是把 AI 编码重构为闭环控制系统：

- **共享的约束账本** 作为 reference signal
- **对抗性审查** 提供 requisite variety
- **阶段门控** 实现质量前移
- **冻结合约** 把规划决策变成编码硬约束
- **回退路由** 在偏差出现时把信号送回正确的层级

---

## 参考文献

Bonfire 的设计借鉴了控制论和软件工程领域的经典工作：

- Wiener, N. (1948). *Cybernetics.* — 控制论基础，闭环控制的理论框架
- Ashby, W.R. (1956). *An Introduction to Cybernetics.* — requisite variety 法则
- Beer, S. (1972). *Brain of the Firm.* — viable system model, algedonic signal
- Boehm, B. (1981). *Software Engineering Economics.* — 变更成本曲线
- Fowler, M. (2005). *Event Sourcing.* — 约束账本的架构参考
- Forsgren, N. et al. (2018). *Accelerate.* — DORA 研究，质量前移
- Liu, N.F. et al. (2023). *Lost in the Middle.* — 长上下文注意力衰减

设计与实施文档：`docs/superpowers/specs/` 与 `docs/superpowers/plans/`。

---

## License

MIT
