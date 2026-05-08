# Stage B — Divergence

← [[10-a-preprocess]] | → [[30-c-requirements]]

## Retained Option

[object Object]

## Options Considered


### 



**Blind spots covered:** a11y (CON-008): 仅修改 DOM 属性 aria-hidden, 易实现, 多扩展共存 (CON-009): 同层挂 observer, 协调 namespace 即可, Censorship-adjacency (CON-010): 不接触底层网络, 自然合规, SPA 切换 (CON-004): 监听 history pushState 后重挂 observer, 4 种播放形态 (CON-003): 选择器适配多容器即可

### 



**Blind spots covered:** RISK-003 完美解决, CON-005 归一化前移到字符串源, CON-006 角色解析直接吃帧字段, 8h 内存 (RISK-002): 帧级 sampling 容易做

### 



**Blind spots covered:** 与 OPT-A 相同的全部 a11y / 共存 / 合规优势, 为 RISK-003 留出后路, 不锁死 MVP 决策, 归一化 (CON-005) 通过统一 NormalizedDanmakuRecord 接口在两层都生效, SPA 切换 (CON-004) 由共享 ContextLifecycle 管控, 两层都受益

