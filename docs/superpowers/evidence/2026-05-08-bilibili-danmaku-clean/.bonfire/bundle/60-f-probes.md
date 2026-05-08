# Stage F — Probes

← [[50-e-closure]] | → [[70-g-red-blue]]

## Probe Results


### B 站直播间 DOM 节点暴露 medalLevel/guardLevel 数据属性, 可在未登录态读取.

**Method:** 在 chrome devtools console 上 querySelectorAll('.chat-item.danmaku-item') 抽样 50 条节点, 打印每节点 dataset 与 className.
**Expected:** 5+ 节点显示 data-medal-level 或 .guard-level-N 类.
**Kill criteria:** 若 0 节点暴露这两个字段 -> 须切换到 OPT-B WS hijack 才能可靠拿到角色信息.
**Result:** INABILITY_TO_PROBE: 当前环境无 headless 浏览器 + 真实 B 站会话.

### 4 种播放形态 (默认/网页全屏/影院/小窗) 弹幕容器使用同一 selector 树.

**Method:** 切换 4 种形态各截图 DOM, diff 弹幕容器祖先链.
**Expected:** 至少 3 种形态共享前缀 selector.
**Kill criteria:** 若 4 种形态全部使用不同 root container, RU-03 需要维护 4 套 selector + 各自 mutation observer 实例.
**Result:** INABILITY_TO_PROBE: 同 PR-1.

### SPA 切房间触发 history.pushState + popstate, 但 bfcache 返回触发 pageshow(persisted=true).

**Method:** Chrome devtools Performance 录制切房间 + 浏览器后退序列, 查看事件触发顺序.
**Expected:** 首次切换: pushState; 后退: pageshow(persisted=true).
**Kill criteria:** 若 pageshow 不触发 -> bfcache restore 路径需独立的 visibilitychange 兜底.
**Result:** INABILITY_TO_PROBE: 同 PR-1.

### 哔哩哔哩助手 / 弹幕姬 当前发布版本仍主流且稳定.

**Method:** Chrome Web Store 搜索 + GitHub star 排序检查最近 commit 时间.
**Expected:** 两者 last commit < 6 个月内.
**Kill criteria:** 若已废弃 -> CON-009 共存目标对象需更新 (但可能更宽松).
**Result:** INABILITY_TO_PROBE: 当前环境无网络访问 (不是 bonfire 限制, 是 dogfood 测试环境).

