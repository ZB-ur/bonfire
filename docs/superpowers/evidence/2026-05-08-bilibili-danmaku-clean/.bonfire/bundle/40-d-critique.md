# Stage D — Critique

← [[30-c-requirements]] | → [[50-e-closure]]

**Agent:** bonfire-d-critique

## Challenges


### ACC-001

Pseudo-acceptance criterion. 'qualitative 体感清爽度' is fundamentally unverifiable and unfalsifiable: there is no operational definition of '清爽', '舒服了', '没漏掉抽奖口令', '没误杀主播'. A verdict of pass/fail cannot be reproduced by an independent reviewer. Worse, it directly contradicts ACC-005 and ACC-004 which DO require concrete fixtures and assertions.

### CON-001

5-class scheme contains latent contradiction between 'lowinfo' (单字含'草') and 'offtopic' AND with VTuber convention ('草 类亚文化弹幕不被一刀切误伤'). RU-05 LowInfoDetector hard-codes '草' into lowinfo set, but VTuber rooms treat 草 as on-topic. Need per-room-category gating or multi-label.

### CON-014

NoiseVerdict frozen as single-category enum is incompatible with RU-05's '5 detector 并联 -> 任一命中'. Parallel detectors will produce multiple positive labels. Single 'category' field forces silent priority decision.

### CON-015

Frozen ordering 'WhitelistEngine -> 归一化 -> 5 detector' contradicts RU-04 which assumes whitelist already reads role/medalLevel from a NormalizedDanmakuRecord (CON-013) — meaning structural normalization (record construction) must happen before whitelist while text normalization happens after. CON-015 collapses two distinct phases.

### RU-11

60s sliding window too short for slow rooms (低流量学习区/sparse VTuber waiting room) where genuine 复读 happens at minute-scale. Conflates memory cap with detection window; needs decoupling.

### CON-013

Frozen interface assumes medalLevel/guardLevel are reliably present on DOM. Hidden_assumption flagged it but never resolved. 'optional ?' conflates absent vs 0 vs unknown — WhitelistEngine 'guardLevel>=1' will silently fail (treat unknown as not-whitelisted) leading to 误杀 of actual 大航海.

### CON-004

SPA reset under-specified for back/forward cache (bfcache). pushState listener does NOT fire on pageshow(persisted=true). Also unclear whether returning to same room A->B->A should reset or resume FloodDetector window.

### RU-05

ToxicDetector spec is pseudo-requirement: '本地侮辱词典 + 上下文增强' has zero sourcing — who supplies dictionary? language coverage (zh-Hant/Japanese for VTuber)? size? update mechanism in MV3? OffTopicDetector is similarly hand-wavy: '与房间分类预设关键词集距离过大' — what distance? what threshold? where's the room->category map?

### CON-009

Multi-extension coexistence asserted IN-scope but no version pinning of 哔哩哔哩助手/弹幕姬. ACC-003's '同时安装' is unfalsifiable across time — those extensions update independently.


## Proposals


### RISK-004 (high_impact_risk)

ToxicDetector 词典来源/许可/语言覆盖未定义 (RU-05). MV3 禁止远程代码 (DROP-003), 词典必须打包进扩展 — 与可维护性 (新词、亚文化变体) 冲突. 若无策略, 该 detector 要么误杀严重要么形同虚设, 等价于 CON-001 frozen_for_code '不允许子集' 被违反.

**Rationale:** RU-05 中 toxic + offtopic 是规格上最薄弱、风险上最大的 detector, 但 ledger 仅讨论传输层与内存.

### RISK-005 (high_impact_risk)

WhitelistEngine 字段依赖 (medalLevel/guardLevel/role) 在 DOM 层可能不可观测 — 未登录态/懒加载/B站改版均导致字段缺失. CON-013 默认 'absent==not-whitelisted' 意味着字段缺失时大航海/SC 被误杀, 直接触发用户卸载.

**Rationale:** preprocess.hidden_assumptions 已标注但未升级为 RISK; CON-013 frozen 后被掩埋.

### CON-016 (frozen_constraint)

NoiseVerdict.category 必须支持多标签 (string[]), 配套 RU-05 detector 优先级阶梯 toxic > ad > flood > lowinfo > offtopic 用于 UI 展示主因.

**Rationale:** 解决 CON-014 与 RU-05 契约不一致.

### ACC-006 (acceptance_semantic)

ACC-001 体感判定补充结构化观察清单 (binary checklist >= 8 项): (1) 30min 内 0 起主播弹幕降噪; (2) 0 起 SC/醒目留言降噪; (3) 至少 1 次复读折叠生效; (4) 切房间后旧 observer 已 disconnect; (5) 高对比度模式 fade 自动降级; (6) console 无 error spam; (7) 登录态弹幕发送 1h 正常; (8) VTuber 房间 '草' 单字至少 50% 通过. 不引入 precision/recall 但条目可被独立复现.

**Rationale:** 拯救 ACC-001 不可验证性, 不引入用户拒绝的精确指标.


## Follow-Up Questions


- ToxicDetector 词典是否引用现成开源 (textfilter / sensitive-word)?

- OffTopicDetector 房间分类来自 B站 API area_id 还是手动表?

- ACC-001 接受改写为 binary checklist (ACC-006 提案)?

- medalLevel/guardLevel 在未登录态是否真的可读, 需要 Stage F probe 验证?

- FloodDetector 是否解耦为时间窗+计数窗双轨?

- NoiseVerdict 升级为多标签? RU-09 浮层 UI 如何展示主因?

- SPA reset 是否覆盖 pageshow(persisted=true) bfcache 场景?

