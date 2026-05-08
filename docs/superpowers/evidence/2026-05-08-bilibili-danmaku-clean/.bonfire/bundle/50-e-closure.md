# Stage E — Closure

← [[40-d-critique]] | → [[60-f-probes]]

## Dependency Chain


### DC-1

MV3 骨架 -> 文本归一化纯函数 -> 双阶段管线编排

**Upstream:** RU-01
**Downstream:** RU-02, RU-15

### DC-2

管线接入两个数据源 (DOM 默认, WS 可选)

**Upstream:** RU-15
**Downstream:** RU-03, RU-07

### DC-3

Whitelist + 字段降级 + 多标签 detector + 动作执行

**Upstream:** RU-15, RU-04, RU-14
**Downstream:** RU-05, RU-06

### DC-4

横切关注: 共存 / 内存 / 合规 / 设置存储 / 反馈

**Upstream:** RU-06
**Downstream:** RU-08, RU-09, RU-10, RU-11, RU-12, RU-13


## Resolved Gaps


- DEP-001 -> Vite + @crxjs/vite-plugin + TypeScript + pnpm 选型锁死

- CON-015 challenge -> RU-15 双阶段拆分, P1 -> Whitelist -> P2 -> detector 顺序

- CON-014 challenge -> CON-016 多标签 verdict 替代单 enum, RU-05 输出契约更新

- RISK-004 -> RU-13 词典策略 (开源 zh-Hans 打包, 无远程更新)

- RISK-005 -> RU-14 字段缺失降级 PROBATION 状态; F-1 probe 验证可见率

- ACC-001 challenge -> ACC-006 binary checklist 8 项替代 (合并而非取代)

