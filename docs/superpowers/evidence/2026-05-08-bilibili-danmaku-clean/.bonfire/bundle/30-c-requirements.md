# Stage C — Requirements

← [[20-b-divergence]] | → [[40-d-critique]]

## Requirement Units


### RU-01: MV3 Manifest + 项目骨架

建立 MV3 manifest.json (host_permissions: live.bilibili.com, www.bilibili.com 视频回放页), background service worker, content script 注入规则. Vite + TypeScript + @crxjs/vite-plugin 构建. 输出 unpacked dist/ 可侧载, 同时输出 zip 供 GitHub release.

**Success criteria:** dist/manifest.json valid; chrome://extensions Load Unpacked 成功; service worker 启动后空操作 < 50ms.
**Depends on:** 

### RU-02: NormalizedDanmakuRecord 接口与归一化管线

定义 NormalizedDanmakuRecord = { rawText, normalizedText, uid?, role?, medalLevel?, guardLevel?, isPaid, ts, sourceLayer: 'dom' | 'ws' }. 归一化步骤: NFKC -> 零宽字符剥离 -> 简繁折叠 (繁->简) -> 拼音 fallback (jieba-pinyin lite or chinese-utils) -> emoji 别名表 (草=艹=cao=🌱, 6=666=陆=六).

**Success criteria:** 单元测试: '草', '艹', 'cao', '🌱', '\u200b艹\u200b' 全部归一化为同一 normalizedText 'cao'.
**Depends on:** 

### RU-03: DOM 拦截层 (默认 MVP 路径)

Content script 在 live.bilibili.com 直播间挂 MutationObserver, 监听弹幕容器 (主弹幕/网页全屏弹幕/影院模式弹幕/小窗弹幕 4 种 selector). 节点新增时构造 NormalizedDanmakuRecord 送入 NoiseClassifier. SPA history.pushState 监听重新挂载.

**Success criteria:** 在 live.bilibili.com/<room>/ 打开后, console 可观察到弹幕节点产生 NormalizedDanmakuRecord 流; 切到另一房间后旧 observer 已 disconnect 且新房间正确接管.
**Depends on:** 

### RU-04: WhitelistEngine (硬豁免)

解析 NormalizedDanmakuRecord 的 role / medalLevel / guardLevel / isPaid 字段, 凡命中 (role=主播|房管 OR isPaid=true OR guardLevel>=1 OR roleClass 含 '总督/提督/舰长/醒目留言/上舰') 直接 verdict=PASS, 跳过所有降噪规则. 优先级最高, 不可被任何规则覆盖.

**Success criteria:** 测试用例: 构造 5 类豁免角色 fixture, 即便文本完全等同已知噪声, classifier verdict 仍为 PASS.
**Depends on:** 

### RU-05: NoiseClassifier 五分类规则引擎

Classifier 输入 NormalizedDanmakuRecord, 输出 { verdict: PASS|NOISE, category: 'flood'|'lowinfo'|'ad'|'toxic'|'offtopic'|null, confidence: 0..1 }. 5 个 detector 各自独立: FloodDetector (滑动窗口 LRU 60s 内 normalizedText hash 出现 >= 3 次), LowInfoDetector (normalizedText 长度<=2 或全为表情/单字字符集 ['6','草','?','哈','233','...']), AdDetector (URL/QQ群号/微信号/'+VX'正则), ToxicDetector (本地侮辱词典 + 上下文增强), OffTopicDetector (与房间分类预设关键词集距离过大, 体感保守阈值).

**Success criteria:** 5 个 detector 各自有独立单元测试 fixture; 整体调用顺序 = whitelist (RU-04) -> 归一化 (RU-02) -> 5 个 detector 并联 -> 任一命中即 verdict=NOISE.
**Depends on:** 

### RU-06: 降噪动作执行器 (3 种动作模式)

Action Executor 读取用户设置 mode='collapse'(default)|'hide'|'fade', 对 NOISE 节点: collapse=合并到 '<category> ×N' 行, hide=aria-hidden+visibility:hidden (注: 不用 display:none, a11y), fade=opacity:0.3. 高对比度 (prefers-contrast: more) 自动从 fade 降级 hide. 操作 DOM 时所有写入加 namespace class 'bdd-*' 避免与其他扩展冲突.

**Success criteria:** 三种模式各自手动 demo 通过; 高对比度系统设置下 fade 自动降级; 操作过的节点都带 'bdd-*' 类.
**Depends on:** 

### RU-07: WebSocket Hook 进阶层 (OPT-C v2 预留, 默认 disabled)

在 page-injected world 重写 window.WebSocket 构造器, 解析 Bilibili 弹幕 WS 帧 (二进制+brotli+protobuf), 转换为 NormalizedDanmakuRecord (sourceLayer='ws'). 同样喂给 RU-04+RU-05+RU-06. MVP 默认设置 enableWsHook=false, 仅高级用户在选项页手动勾选启用. 帧 schema 解析失败时降级为 DOM 层 fallback (不抛错给页面).

**Success criteria:** 默认安装下不注入 page world; 用户启用后 console 可见 'WS frames intercepted: N'; protobuf schema 改变时 fallback 路径不报错.
**Depends on:** 

### RU-08: 用户设置面板 (popup + options page)

Popup: 一键开关降噪 + 模式切换 (collapse/hide/fade) + 当前房间统计 '今日已降噪 X 条'. Options page: 关键词黑名单 / UID 黑名单 / 房间白名单 / 关键词白名单 / 高级 (启用 WS hook). 数据存 chrome.storage.local. 不使用 chrome.storage.sync (frozen_for_code).

**Success criteria:** popup 加载 < 200ms; options 修改后 content script 在 1s 内热生效 (通过 chrome.storage.onChanged).
**Depends on:** 

### RU-09: 误判可恢复 + 反馈循环

降噪角标点击展开浮层, 列出本会话被降噪的弹幕 (rawText/UID/ts/category/confidence). 每条带 '放回' 按钮: 点击后该 normalizedText hash 加入会话级白名单, 之后 60s 内同 hash 不再被 NoiseClassifier 拦截. 'Always allow' 按钮则永久写入 chrome.storage.local 用户白名单 (RU-08).

**Success criteria:** demo: 故意把'抽奖口令'当作 lowinfo 拦截 -> 浮层可见 -> 点击'放回' -> 之后同房间下相同口令不再被拦截.
**Depends on:** 

### RU-10: 多扩展共存策略

MutationObserver 仅在 RU-06 写入的 'bdd-*' 类节点上回环过滤; 不删除其他插件添加的子节点 (用 attribute hide 而非 removeChild); WebSocket 劫持仅在用户启用时, 且使用 WeakMap 记录已 patched 的实例避免重复 patch (与 哔哩哔哩助手 共存场景).

**Success criteria:** 并存场景手动验收 (ACC-003): 装本插件 + 哔哩哔哩助手 + 弹幕姬, 在 console 无 error; 弹幕区无双重隐藏闪烁.
**Depends on:** 

### RU-11: 8h Session 内存稳定性

FloodDetector 滑动窗口实现: Map<hash, {count, firstSeenTs, lastSeenTs}>, 周期性 (每 30s) 清除 lastSeenTs 早于 60s 前的 entries. 浮层日志最大保留 1000 条 (LRU). NormalizedDanmakuRecord 不长期保留, 仅 detector 用完即弃.

**Success criteria:** ACC-002: 1h/4h/8h 三个时点 chrome://task-manager 内存涨幅 < 20%.
**Depends on:** 

### RU-12: Censorship-adjacency 边界 + 反作弊规避

硬编码: 严禁向 *.bilibili.com 发送任何 fetch/XHR/WebSocket 请求 (ESLint 规则 no-network-call); 严禁修改 B 站发往后端的请求体 (无 webRequestBlocking 权限申请); 仅 host_permissions 限定到 *.bilibili.com 用于读 page DOM. MutationObserver 节流 (requestIdleCallback + microtask batch).

**Success criteria:** manifest 不含 webRequestBlocking 权限; ESLint 规则触发拦截; 在登录账户下连续运行 1h 不出现弹幕发送被静默吞.
**Depends on:** 

