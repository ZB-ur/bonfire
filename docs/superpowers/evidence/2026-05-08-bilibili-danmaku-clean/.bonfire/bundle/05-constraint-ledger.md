# Constraint Ledger

**Generated:** 2026-05-07T16:16:20.964Z
**Total entries:** 119

## Frozen Constraints


### FACT-001 (confirmed_fact)
- **Content:** 项目根目录是空 git repo (master 分支, 无 commit, 无任何源码/manifest/package.json), 仅有 .bonfire/ pipeline scaffold
- **Rationale:** reality-checker glob 全部源码扩展返回空, 仅 .bonfire/*.json
- **Challenged by:** 
- **Aligned by:** 

### FACT-002 (confirmed_fact)
- **Content:** 用户原始请求 verbatim: '做一个 B 站直播间弹幕降噪 Chrome 插件'
- **Rationale:** case.json source_request 字段直接验证
- **Challenged by:** 
- **Aligned by:** 

### CON-001 (retained_goal)
- **Content:** 插件需识别并降噪五类噪声弹幕: (a)刷屏/复读 (b)纯表情或单字符无信息量弹幕(6/草/?/233等) (c)广告引流/外链 (d)人身攻击/辱骂/toxicity (e)与直播主题严重无关的闲聊。五类全部 in-scope, 不允许只做其中一两类。
- **Rationale:** 用户人格选定后明确要求'比 B 站自带屏蔽词更聪明',五类全要
- **Challenged by:** d-critique
- **Aligned by:** 

### CON-002 (retained_goal)
- **Content:** 降噪动作: 默认 '折叠合并并显示计数' (例如 100 条相似弹幕折叠为 '6 ×100'); 用户可在设置中切换为 '完全隐藏' 或 '半透明淡化'。三种动作模式都需实现, 默认折叠。
- **Rationale:** 用户希望保留弹幕氛围 + 可审计 + 不丢抽奖口令
- **Challenged by:** 
- **Aligned by:** stage-g-survival

### CON-003 (retained_goal)
- **Content:** 降噪范围: live.bilibili.com 直播间 (网页直播间, 网页全屏, 浏览器全屏, 影院模式, 小窗悬浮 4 种播放形态都覆盖) + 直播回放页面 (含弹幕池历史回放)。VOD /video/ 普通视频弹幕暂不在 scope。
- **Rationale:** 用户'直播间'语义+边缘形态全包以暴露 plan 阶段是否捕获 over-scope
- **Challenged by:** 
- **Aligned by:** stage-g-survival

### CON-004 (retained_goal)
- **Content:** SPA 路由切换 (从一个直播间跳到另一直播间, 不刷新页面) 必须正确重置降噪上下文: 旧房间 mutation observer/WebSocket listener 解绑, 复读统计清空, 新房间重新初始化。在 scope。
- **Rationale:** blind-spot-scout flagged, 用户人格场景 (跳房间)
- **Challenged by:** d-critique
- **Aligned by:** 

### CON-005 (retained_goal)
- **Content:** 归一化: 全角/半角统一(NFKC), 零宽字符剥离, 简繁体折叠, 拼音 fallback (sh ua p ing -> shuaping), emoji 与文字别名归并 (草=艹=cao=🌱)。用于复读/刷屏检测前置归一化。In-scope。
- **Rationale:** blind-spot-scout 列举 Unicode 绕过手法; 不归一化则复读检测无效
- **Challenged by:** g-red
- **Aligned by:** 

### CON-006 (retained_goal)
- **Content:** 角色身份豁免 (永不降噪): (a) 主播本人发言 (b) 房管发言 (c) 醒目留言/SC 等价物 (d) 大航海/舰长/提督/总督发言 (e) 上舰/礼物相关系统提示。从弹幕节点的 medal/guard level/role class 解析判定。In-scope, hard 白名单优先级最高。
- **Rationale:** blind-spot-scout 强调付费/角色不可降噪; 否则用户卸载
- **Challenged by:** g-red
- **Aligned by:** 

### CON-007 (retained_goal)
- **Content:** 用户可定义: 关键词黑名单 + UID 黑名单 + 白名单房间 (在该房间整体禁用降噪) + 白名单关键词 (永不降噪)。同时插件提供开箱即用默认规则集, 零配置即可启动。
- **Rationale:** 用户人格双需求: 既要默认即用又要细调
- **Challenged by:** 
- **Aligned by:** stage-g-survival

### CON-008 (retained_goal)
- **Content:** 无障碍 (a11y) 兼容: 隐藏的弹幕节点必须使用 aria-hidden + visibility 而非纯 display:none, 屏幕阅读器不应朗读已降噪内容; 折叠面板可键盘导航; 高对比度模式下淡化模式自动降级为隐藏模式。
- **Rationale:** blind-spot-scout 主动 IN-scope: a11y 是用户通常想不到的轴
- **Challenged by:** 
- **Aligned by:** stage-g-survival

### CON-009 (retained_goal)
- **Content:** Multi-extension 共存: 与 哔哩哔哩助手 / 弹幕姬 / 通用 B 站屏蔽插件 在同一页面共存不互相破坏。要求: 不删除其他插件添加的节点, 仅修改自己 namespace 下的 class/attr; mutation observer 过滤掉自身写入避免回环。
- **Rationale:** blind-spot-scout 主动 IN-scope: 多扩展共存是用户通常想不到的轴
- **Challenged by:** d-critique, g-red
- **Aligned by:** g-blue

### CON-010 (retained_goal)
- **Content:** Censorship-adjacency 边界: 仅 client-side hide. 严禁调用 B 站举报/删除 API; 严禁向其他用户视角泄露屏蔽行为; 严禁修改 B 站发送给后端的请求体 (心跳/弹幕发送)。降噪是单用户客户端行为, 不影响其他人也不影响平台数据。
- **Rationale:** blind-spot-scout 主动 IN-scope: 平台合规边界
- **Challenged by:** g-red
- **Aligned by:** 

### CON-011 (retained_goal)
- **Content:** 误判可恢复性: 提供 '今日已降噪 X 条' 角标 + 点击展开可逐条查看被屏蔽弹幕(含原文/原 UID/时间戳/降噪原因) + 可一键标记为'误杀'放回主弹幕流, 误杀反馈进入本地学习样本调整后续阈值。
- **Rationale:** 用户人格关心抽奖口令/主播互动, 必须可审计可申诉
- **Challenged by:** 
- **Aligned by:** stage-g-survival

### CON-012 (retained_goal)
- **Content:** MV3 + 多浏览器兼容: Chrome (MV3) 主目标; Edge Chromium 自动兼容; Firefox 通过 webextension-polyfill 适配; 国内 Chromium 套壳 (360 极速/QQ/搜狗/Wukong) best-effort, 不做特化适配但要求关键 API 路径不依赖独占特性。
- **Rationale:** 用户人格使用 Edge 兼看 B 站, 浏览器范围明确扩大 IN-scope
- **Challenged by:** 
- **Aligned by:** stage-g-survival

### DEP-001 (dependency_chain)
- **Content:** 用户 reality-checker 报告本机无 package.json, plan 阶段需要决定是否搭 npm/pnpm + 何种构建工具 (Vite/wxt/plasmo/CRXJS)。该选型是后续所有 code 阶段的前置依赖。
- **Rationale:** reality-checker missing_evidence
- **Challenged by:** 
- **Aligned by:** 

### ACC-001 (acceptance_semantic)
- **Content:** 验收方式: qualitative '体感清爽度' 判定。在一个用户自选的真实热门直播间(目标: VTuber 区或游戏区, 弹幕速率 >50 条/秒)开启降噪 30 分钟, 用户主观判断 '看得舒服了, 没漏掉抽奖口令, 没误杀主播弹幕'。不要求量化的 precision/recall 指标。
- **Rationale:** 用户偏好 qualitative 判定, 故意压测 acceptance_semantic 容纳软性条款
- **Challenged by:** d-critique
- **Aligned by:** 

### ACC-002 (acceptance_semantic)
- **Content:** 验收次要项: 八小时长直播 session 内浏览器 tab 内存不持续增长 (峰谷波动可接受, 但 1h/4h/8h 三个时点的 baseline 不应单调上升超过 20%)。仍是体感+任务管理器观察, 不强制自动化测试。
- **Rationale:** RISK-002 对应的体感验收
- **Challenged by:** 
- **Aligned by:** stage-g-survival

### ACC-003 (acceptance_semantic)
- **Content:** 验收兜底: 同时安装 哔哩哔哩助手 + 弹幕姬 时, 三个插件并存不出现弹幕区闪烁/双重隐藏/控制台 error spam。也是体感观察。
- **Rationale:** CON-009 对应验收
- **Challenged by:** 
- **Aligned by:** stage-g-survival

### CON-013 (frozen_constraint)
- **Content:** NormalizedDanmakuRecord 接口字段固定: rawText, normalizedText, uid?, role?, medalLevel?, guardLevel?, isPaid:bool, ts, sourceLayer:'dom'|'ws'. RU-02 产出, RU-04/RU-05 消费. 不允许子集实现.
- **Rationale:** RU-02 接口冻结, OPT-C 双层共享前提
- **Challenged by:** d-critique, g-red
- **Aligned by:** g-blue

### CON-014 (frozen_constraint)
- **Content:** NoiseVerdict 字段: verdict:'PASS'|'NOISE', category:'flood'|'lowinfo'|'ad'|'toxic'|'offtopic'|null, confidence:0..1. RU-05 产出, RU-06 消费.
- **Rationale:** RU-05 接口冻结
- **Challenged by:** d-critique
- **Aligned by:** 

### CON-015 (frozen_constraint)
- **Content:** Classifier 调用顺序硬性: WhitelistEngine -> 归一化 -> 5 个 detector 并联. 任一逆序即视为契约违反.
- **Rationale:** RU-04+RU-05 调用顺序冻结
- **Challenged by:** d-critique
- **Aligned by:** 

### ACC-004 (acceptance_semantic)
- **Content:** 归一化幂等性单元测试通过: normalize(normalize(x)) == normalize(x) 对所有 detector 输入成立.
- **Rationale:** RU-02 验收
- **Challenged by:** 
- **Aligned by:** stage-g-survival

### ACC-005 (acceptance_semantic)
- **Content:** WhitelistEngine 优先级测试: 5 类豁免角色 fixture (主播/房管/SC/大航海/上舰) 即便文本完全等同已知噪声, classifier verdict 仍为 PASS.
- **Rationale:** RU-04 验收
- **Challenged by:** 
- **Aligned by:** stage-g-survival

### DEP-002 (dependency_chain)
- **Content:** RU-03 (DOM) + RU-07 (WS) 都依赖 RU-02 (归一化) + RU-04 (whitelist) + RU-05 (classifier) + RU-06 (executor); RU-08 (设置) 是 RU-03/RU-06/RU-07 行为开关源; RU-09 (反馈) 依赖 RU-06 写出的 DenoisedSessionLog.
- **Rationale:** Stage E 闭包依赖描述前置
- **Challenged by:** 
- **Aligned by:** 

### CON-016 (frozen_constraint)
- **Content:** NoiseVerdict.category 多标签 (string[]) + 优先级阶梯 toxic > ad > flood > lowinfo > offtopic 用于 UI 展示主因.
- **Rationale:** stage-d resolves CON-014 vs RU-05 contradiction
- **Challenged by:** g-red
- **Aligned by:** g-blue

### ACC-006 (acceptance_semantic)
- **Content:** ACC-001 体感判定补充 8 项 binary checklist: 主播0降噪/SC0降噪/复读折叠生效/observer disconnect/高对比度fade降级/console无error/登录态弹幕发送正常/VTuber草50%通过. 条目可独立复现.
- **Rationale:** stage-d salvages ACC-001 falsifiability
- **Challenged by:** 
- **Aligned by:** g-blue

### CON-017 (frozen_constraint)
- **Content:** RU-15 Phase 2 归一化扩展三步: (P2.0) BiDi 控制字符剥离 U+202A-202E + U+2066-2069; (P2.1) NFC 组合标记折叠 (U+0300-036F); (P2.2) Variation Selector 剥离 U+FE00-FE0F + U+E0100-E01EF. 顺序 BiDi -> NFKC -> 组合标记 -> 零宽 -> Variation -> 简繁 -> 拼音 -> emoji 别名. 闭合 RISK-006.
- **Rationale:** blue mitigation
- **Challenged by:** 
- **Aligned by:** stage-g-survival

### CON-018 (frozen_constraint)
- **Content:** FloodDetector 双轨 hard-cap: 时间窗 60s 默认 + 可调; Map.size 上限 8192 LRU; 单 tick 入桶速率 500, 超过 sampling. 闭合 RISK-007 + 慢房间挑战.
- **Rationale:** blue mitigation
- **Challenged by:** 
- **Aligned by:** stage-g-survival

### CON-019 (frozen_constraint)
- **Content:** RU-14 PROBATION 闭环: skip detector + audit log; 同 uid PROBATION 内被标记噪声 >=3 次自动出名单; '清空 PROBATION' 按钮; /code 第一次 dev session 实测 medalLevel 可见率, <50% 时改为 'fans-medal-only -> 进 detector + 0.2 confidence 减分'.
- **Rationale:** blue mitigation
- **Challenged by:** 
- **Aligned by:** stage-g-survival

### CON-020 (frozen_constraint)
- **Content:** RU-13 词典审计强制: 引入开源词典必须人工剥离政治审查类, 仅留 profanity/人身攻击/广告; 仓库内 audited-zh-profanity.txt + README 标注 license/source/removed-categories; RU-08 高级设置可关闭 ToxicDetector. 闭合 RISK-009.
- **Rationale:** blue mitigation
- **Challenged by:** 
- **Aligned by:** stage-g-survival

### CON-021 (frozen_constraint)
- **Content:** RU-09 反馈安全栏: Always allow 二次确认; 速率限制 10/min; 7 天衰减 + bulk revoke; toxic Always allow 需键入 CONFIRM, 60s 会话白名单完全禁用 toxic; 浮层显示 always-allow 总数与 7 天新增. 闭合 RISK-011.
- **Rationale:** blue mitigation
- **Challenged by:** 
- **Aligned by:** stage-g-survival

### CON-022 (frozen_constraint)
- **Content:** isPaid + fans-medal 防伪: WhitelistEngine 必须组合 >=2 DOM 信号; 单 fans-medal 仅 PROBATION; isPaid 必须 .super-chat-message/.gift-bubble 父层级验证. 闭合 CON-013/CON-006 forgery.
- **Rationale:** blue mitigation
- **Challenged by:** 
- **Aligned by:** stage-g-survival


## Proposed / Challenged


### CLAIM-001 [CHALLENGED] (challenged_claim)
- **Content:** 用户字面要求'Chrome 插件',隐含 MV3 但未确认是否兼容 Edge/Firefox/国内套壳浏览器
- **Rationale:** 用户原文未提浏览器范围, intent-extractor flagged


## Open Risks


### RISK-001
- **Content:** B 站反爬/风控可能因 mutation observer 频繁触发或 DOM class 异常而对登录用户实施 shadowban (弹幕发送被静默吞)。降噪逻辑必须避免高频 querySelectorAll / 不修改非自有 namespace 节点 / 不发送任何额外网络请求。
- **Rationale:** blind-spot-scout 提示 B 站风控指纹检测; 用户卸载触发器

### RISK-002
- **Content:** 8 小时跨夜直播下若使用全量缓存 (Map<text,count>) 做复读检测会内存无界增长, Chrome tab 内存可能涨到 GB 级。必须采用滑动窗口 (例如最近 5 分钟或最近 2000 条) + LRU + sampling 策略。
- **Rationale:** blind-spot-scout 8h session 警告

### RISK-003
- **Content:** 弹幕真实传输是 WebSocket protobuf, 仅 DOM 拦截会导致弹幕短暂闪现 1 帧再被隐藏, 用户体验割裂。但 WebSocket 劫持工作量与稳定性风险都更高。MVP 决策: DOM 拦截优先, WebSocket 劫持作为 v2 演进路径, plan 阶段需明确选型代价。
- **Rationale:** blind-spot-scout 传输层选型

### RISK-004
- **Content:** ToxicDetector 词典来源/许可/语言覆盖未定义 (RU-05). MV3 禁止远程代码 (DROP-003), 词典必须打包. 若无策略, 该 detector 误杀严重或形同虚设.
- **Rationale:** stage-d critique

### RISK-005
- **Content:** WhitelistEngine 字段依赖 medalLevel/guardLevel/role 在 DOM 层可能不可观测. 未登录态/懒加载/B站改版导致字段缺失, 默认 absent==not-whitelisted 将误杀大航海/SC.
- **Rationale:** stage-d critique upgrades hidden_assumption to risk

### RISK-006
- **Content:** BiDi/combining-mark/variation-selector Unicode evasion. RU-15 Phase 2 不覆盖 U+202A-202E/U+0300-036F/U+FE00-FE0F. 5 行攻击者 JS 即可破 FloodDetector + LowInfoDetector.
- **Rationale:** g-red attack

### RISK-007
- **Content:** Sustained-burst 内存耗尽: 50K unique-padded danmaku/30s 钉住 lastSeenTs, GC 无法清, Map.size 无界. ACC-002 只测被动 8h 增长, 不测对抗性 burst.
- **Rationale:** g-red attack

### RISK-008
- **Content:** RU-14 PROBATION 是生产默认 (非 fallback), 因 PR-1 INABILITY_TO_PROBE. fans-medal 类 (1 元可买) 旁路所有 5 detector, 无 PROBATION->enforce 反向路径.
- **Rationale:** g-red attack

### RISK-009
- **Content:** 字典污染: 开源 zh-Hans 列表把政治审查词与 profanity 混在一起. Sideload 即静默审查政治言论, 违反 CON-010 + 用户信任. License 归属未处理.
- **Rationale:** g-red attack

### RISK-010
- **Content:** Bilibili 反扩展计数器: A/B 测试扫描器检测 bdd-* / aria-hidden 模式, 可能 shadowban / 注入 counter-CSS / canvas 重绘. CON-010 单向, 未武装平台进攻面.
- **Rationale:** g-red attack

### RISK-011
- **Content:** RU-09 'Always allow' 模型投毒: 无速率限制, 无审计, 无衰减, 无 bulk-revoke. 60s '放回' 无防抖, 攻击者抢闯 toxic.
- **Rationale:** g-red attack


## Discarded Options


### DROP-001
- **Content:** VOD 普通视频 (/video/) 弹幕降噪不做 — 用户场景是直播观感优化, VOD 弹幕生态/密度/性质都与直播弹幕不同, 并入会模糊核心目标。
- **Rationale:** 范围收口, 用户人格中度直播观众

### DROP-002
- **Content:** Chrome Web Store 上架不做 — 用户人格自用 + 开源 GitHub sideload, 不做 store-grade 隐私政策/i18n/审核工程。
- **Rationale:** 用户人格分发偏好

### DROP-003
- **Content:** 云端 LLM 语义判断不做为 MVP 默认 — 必须 100% 本地处理 (规则 + 局部启发式), 不发送任何弹幕到远程服务器。用户可自带 OpenAI key 配置高级语义模式作为 OPTIONAL v2 特性, 但 MVP 不实现。
- **Rationale:** 隐私边界 + MV3 远程代码限制 + 用户偏好本地

