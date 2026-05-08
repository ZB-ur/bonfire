# Stage A — Preprocess

← [[00-overview]] | → [[20-b-divergence]]

## Reframed Goal

MV3 Chrome 扩展, B 站直播弹幕 5 类客户端降噪, 默认折叠合并, 角色硬白名单, 100% 本地, 兼容 SPA / 4 种播放形态 / 多扩展共存 / a11y / 回放, 不上架商店, sideload + 开源 GitHub.

## Retained Scope


- 5 类噪声识别: 刷屏复读 / 纯表情单字 / 广告引流外链 / toxicity辱骂 / 偏题闲聊 (CON-001)

- 三种降噪动作: 折叠计数(默认) / 完全隐藏 / 半透明淡化 (CON-002)

- 页面范围: 直播间 + 回放 + 网页全屏 + 影院 + 小窗 (CON-003)

- SPA 切换降噪上下文重置 (CON-004)

- 归一化: NFKC / 零宽剥离 / 简繁折叠 / 拼音 / emoji 别名 (CON-005)

- 硬白名单豁免: 主播 / 房管 / SC / 大航海 / 礼物上舰 (CON-006)

- 用户自定义: 关键词 + UID 黑名单 + 房间白名单 + 关键词白名单 + 默认开箱即用 (CON-007)

- a11y: aria-hidden + 高对比度自动降级 + 键盘可达 (CON-008)

- 多扩展共存: 哔哩哔哩助手 / 弹幕姬 (CON-009)

- Censorship-adjacency: 仅 client-side hide, 不调 B 站 API, 不污染他人视角 (CON-010)

- 误判可恢复 + '今日降噪 X 条' 角标 + 反馈循环 (CON-011)

- MV3 + Chrome 主 + Edge 自动 + Firefox polyfill + 国内套壳 best-effort (CON-012)


## Excluded Scope


- VOD /video/ 普通视频弹幕 (DROP-001)

- Chrome Web Store 上架 (DROP-002)

- 云端 LLM MVP (DROP-003)

- i18n 多语言 UI

- 移动端 / Bilibili App

- 跨设备 chrome.storage.sync

- 替代 B 站自带屏蔽词

- 向 B 站后端发任何举报/删除请求

- 付费弹幕/SC 降噪 (硬豁免)


## Critical Assumptions


- B 站直播弹幕节点的角色信息 (主播/房管/SC/大航海) 可从 DOM class 或 data-* 属性解析, 无需登录态

- DOM 拦截 + mutation observer 即可满足 MVP 降噪需求, WebSocket protobuf 劫持留作 v2

- 局部启发式 + 规则引擎 + 滑动窗口 LRU 即可在 8h session 下保持内存稳定

- 用户接受 '默认折叠 + 可逐条恢复' 的非破坏性降噪而非硬删除

- '噪声' 标准随用户社区文化 (VTuber/游戏区) 默认提供两套预设规则集


## Frozen for Code


- 5 类噪声 (CON-001) 不允许只实现子集

- 默认动作 = 折叠合并显示计数, 不允许默认 = 隐藏 (CON-002)

- 硬白名单豁免清单 (CON-006) 不允许任何降噪规则覆盖

- 100% 本地无远程调用 (DROP-003) 不允许偷偷加遥测/云模型

- Censorship-adjacency 边界 (CON-010) 不允许调用 B 站后端

- 归一化必须前置于复读检测 (CON-005)

- MV3 而非 MV2


## Ambiguity Points


- '噪声' 未定义: 刷屏复读 / 单字符 / 广告引流 / toxicity / 偏题闲聊 / 剧透 哪几类全部包含?(决议: 五类全部 in-scope, 不含剧透)

- 降噪动作未定义: 隐藏 / 折叠计数 / 半透明淡化 / 标记不删 (决议: 三种行为模式都实现, 默认折叠)

- 范围未定义: 仅直播间? 含回放? 含 VOD? 含网页全屏/影院/小窗? (决议: 直播间+回放+四种播放形态, 不含 VOD)

- MV3 浏览器范围: Chrome only? Edge/Firefox/国内套壳? (决议: Chrome 主目标 + Edge 自动 + Firefox webextension-polyfill + 套壳 best-effort)

- 联网允许度: 100% 本地 vs 云端 LLM (决议: MVP 100% 本地, 用户自带 key 云模式作为 v2 OPTIONAL)

- 误杀 vs 漏判优先级 (决议: 不强行二选一, 通过 '可恢复 + 用户反馈调阈值' 中和, 验收使用 qualitative 体感判定)

- 插件分发: 商店上架 vs sideload (决议: sideload + GitHub 开源, 不上架)

- 登录态依赖: 是否需要 cookie/账号 (决议: 不需要登录, 仅从公开 DOM 解析角色信息)

- 与 B 站自带屏蔽词关系 (决议: 叠加, 不替代; 不互调用)

- 与其他 B 站扩展 (哔哩哔哩助手/弹幕姬) 共存 (决议: in-scope, 共存不破坏)

