# Stage G — Red-Blue

← [[60-f-probes]] | → [[80-h-review]]

## Red Team Challenges


### CON-005

BiDi/combining/variation-selector evasion: NFKC + zero-width strip don't cover U+202A-202E, U+0300-036F, U+FE00-FE0F. Adversary breaks FloodDetector by inserting random RLO between identical复读 text.

### CON-006

Hard whitelist on fans-medal class via DOM heuristic is forgeable. 1 元 buys fans-medal; hostile coexistence extensions can inject fans-medal class onto noise nodes for whitelist immunity.

### CON-009

Multi-extension coexistence does not address ADVERSARIAL coexistence. Hostile extension can strip bdd-* classes, win WS prototype patch race, or use Object.defineProperty to bypass WeakMap dedup.

### CON-010

Censorship-adjacency boundary is one-directional. No countermeasure for Bilibili A/B-testing extension detection that flags accounts, injects counter-CSS, or canvas-re-renders. RISK-001 only covers indirect risk control.

### RU-13

Open-source zh-Hans sensitive-word lists mix political censorship terms with profanity — silently performs client-side political censorship, violating CON-010 + user trust. Attribution not addressed. zh-Hant/Japanese exclusion violates CON-001 'no subset' for VTuber rooms.

### RU-14

PROBATION paradox: skip-detector interpretation = hard-whitelist by another name; run-with-threshold interpretation = threshold undefined. Plus PR-1 INABILITY_TO_PROBE means PROBATION is permanent default, not fallback.

### RU-08

chrome.storage.local 5MB quota, no atomicity, cross-extension readable with management permission, no schema migration, no corruption recovery, silent fail on quota exceeded.

### RISK-002

Sustained-burst attack: 50K unique-padded danmaku/30s pins lastSeenTs forever, GC never evicts, Map grows unboundedly. RU-12 requestIdleCallback starved during burst.

### ACC-006

Binary checklist still subjectively interpretable. Item (3) '至少 1 次复读折叠生效' fails on quiet rooms with no复读. Item (8) '50% 通过' over undefined denominator. Item (4) requires devtools snippet not user-reproducible.

### CON-016

Multi-label priority ladder creates user-whitelist vs toxic-priority undefined precedence. Attacker poisons via RU-09 'always allow' on benign-looking string then mutates to toxic with same normalizedText.

### CON-013

isPaid:bool non-optional + RU-04 '=true -> hard whitelist' + DOM heuristic = SC-masquerade attack. Skin extensions or A/B variants set 'paid' class on regular danmaku; once true, permanent immunity.

### PR-1

INABILITY_TO_PROBE for PR-1/PR-2/PR-3 with 'defer to /code' is a handoff-quality-bar violation. RU-14 PROBATION default depends on PR-1; RU-03 SelectorRegistry depends on PR-2; bfcache wiring depends on PR-3. Stage F failed but pretends success.

### RU-09

Model poisoning surface: 'Always allow' has no rate limit, no decay, no bulk-revoke, no audit. Storage compromise injects 1000 toxic allowances. 60s session whitelist has no debounce — race to slip toxic through.

### DEP-001

Supply-chain risk on @crxjs/vite-plugin (small team, no version pinning policy, no audit step, no Rollup fallback). MV3 deprecation cycle could break sideload.

### RU-12

ESLint 'no-network-call' insufficient: dynamic URL construction evades string-match; chrome.runtime.sendMessage to background fetch evades; minified vendored deps invisible; runtime CSP not enforced; user can self-grant via manifest edits.


## Blue Team Alignments


### RISK-006

BiDi/combining/variation-selector 是真实存在的绕过手段, RU-15 Phase 2 不完备. CON-017 闭合.

### RISK-007

Sustained burst 攻击成立, ACC-002 仅测 8h 被动. CON-018 双轨 hard cap 闭合.

### RISK-008

PR-1 INABILITY_TO_PROBE 让 PROBATION 实质永久. CON-019 提供反向路径.

### RISK-009

字典污染命中 CON-010 censorship-adjacency. CON-020 闭合.

### RISK-011

RU-09 缺速率限制/衰减/audit. CON-021 闭合.

### CON-013

isPaid + DOM 启发式可被多扩展环境伪造. CON-022 闭合主要风险, 完全防伪超 MVP.

### RISK-010

Bilibili 反扩展是真实平台行为, 接受残余风险: 用户自用 sideload + per-install 随机 namespace 会破坏共存 + 平台封号属用户自担. 不引入反检测专项.

### RU-08

5MB quota / 跨扩展可读真实但用户人格自用 + 5MB 远超关键词需求 + 跨扩展依赖对方拥 management 权限 (主机沦陷的更深层问题). 接受残余, /code 阶段在 popup 显式提示 quota 失败.

### DEP-001

@crxjs/vite-plugin 供应链风险真实但不可消除. pnpm lockfile + 公开 commit hash 审计是 MVP 上限. 不引入 npm-audit 流水线 (人格不长期维护).

### RU-12

ESLint 可被绕过, 但单一开发者 + MV3 manifest host_permissions + CSP 阻断 eval 已是兜底. 不加 runtime CSP 自检.

### ACC-006

(3)(8) 主观性成立但是 ACC-001 不可证伪的进步. 用户人格选择 qualitative; (3) 补'若房间无复读则 N/A'.

### CON-009

敌对扩展抢占 WS / defineProperty 绕过成立. 接受残余风险: 自用 sideload + 防御敌对扩展属浏览器沙箱职责, CON-009 只承诺与主流良性扩展共存.

### CON-016

user-whitelist vs toxic 优先级未定 + 投毒. CON-021 (e) toxic always-allow 强阻断已闭合. 多标签优先级仅用于 UI 主因展示, 不参与决策.


## Proposals


### CON-017 (frozen_constraint)

RU-15 Phase 2 归一化扩展三步: (P2.0) BiDi 控制字符剥离 U+202A-202E + U+2066-2069; (P2.1) NFC 组合标记折叠 (剥离 U+0300-036F 非语义组合标记); (P2.2) Variation Selector 剥离 U+FE00-FE0F + U+E0100-E01EF. 顺序: BiDi -> NFKC -> 组合标记 -> 零宽 -> Variation Selector -> 简繁 -> 拼音 -> emoji 别名. 闭合 RISK-006.

**Rationale:** RISK-006 5 行 JS 攻击成立, 修复成本 < 30 行代码.

### CON-018 (frozen_constraint)

FloodDetector 双轨 hard-cap: (a) 时间窗 60s 默认可在 RU-08 调到 5min/10min 适配低流量房间; (b) Map.size 硬上限 8192, LRU 淘汰; (c) 单 tick (1s) 最大入桶速率 500, 超过即降级为 sampling. 闭合 RISK-007 + d-critique 慢房间挑战.

**Rationale:** Burst 攻击 + 慢房间挑战联合修复.

### CON-019 (frozen_constraint)

RU-14 PROBATION 闭环: (a) PROBATION = skip detector + 写 audit log, 非隐式硬白名单; (b) 同 uid PROBATION 内 RU-09 浮层标记'其实是噪声' >= 3 次自动出 PROBATION 进 detector; (c) RU-08 提供 '清空 PROBATION' 按钮; (d) /code 第一次 dev session 实测 medalLevel 可见率, < 50% 时 RU-14 默认改为 'fans-medal-only -> 进 detector + 0.2 confidence 减分' 而非旁路.

**Rationale:** RISK-008 + PR-1 INABILITY_TO_PROBE 联合修复.

### CON-020 (frozen_constraint)

RU-13 词典审计强制: (a) 引入开源词典必须人工剥离政治审查类 (人名/事件/地名), 仅留 profanity/人身攻击/广告; (b) 仓库内 dict/audited-zh-profanity.txt 单文件呈现 + README 标注 license/source commit/removed-categories; (c) RU-08 高级设置可关闭 ToxicDetector 整体 (用户主动 opt-out 不算违反 frozen_for_code). 闭合 RISK-009.

**Rationale:** 字典污染攻击命中 CON-010 边界, 必须 mitigate.

### CON-021 (frozen_constraint)

RU-09 反馈循环安全栏: (a) 'Always allow' 二次确认弹窗显示原文与 category; (b) 速率限制 10 条/分钟, 触上限锁 60s; (c) 7 天衰减 + bulk revoke 按钮; (d) toxic category 的 Always allow 需键入 'CONFIRM' 字符串, 60s 会话白名单完全禁用 toxic 旁路; (e) 浮层显示 'always-allow 总数 + 7 天新增' 用户可见审计. 闭合 RISK-011.

**Rationale:** 投毒漏洞 mitigate, 全套 audit log 省略以匹配自用 MVP.

### CON-022 (frozen_constraint)

isPaid + fans-medal 防伪: (a) WhitelistEngine 不再单独依赖 fans-medal class, 必须组合至少 2 DOM 信号 (medalLevel 数据属性 + 节点祖先含 .super-chat-message 容器, 或 guard-level-N + role badge); (b) 单一 fans-medal class 仅触发 PROBATION 不进硬白名单; (c) isPaid:true 必须由专用 SC/上舰容器 (.super-chat-message, .gift-bubble) 父层级验证. 闭合 CON-013/CON-006 forgery 攻击.

**Rationale:** 双信号 + 容器层级是 DOM 启发式可达下界, 加密认证超 MVP scope.

