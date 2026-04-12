# Bonfire

把 AI coding 从开环祈祷变成闭环工程。

## 问题

你让 AI 写一个带用户认证的 REST API。几千行代码之后你发现：它把你的 session 存进了 localStorage 而不是 httpOnly cookie，因为"这样更简单"。它把密码哈希用了 MD5，因为你没说用 bcrypt。它把 API 从 REST 改成了 GraphQL，因为它觉得"更现代"。

这些不是 bug。Bug 可以调试。这些是 **AI 在编码过程中静默做出的产品决策**——你没有要求、没有审批、甚至没有意识到的决策。等你发现时，代码已经写完了。

这就是 vibe coding 的系统性风险：prompt → code 之间没有约束传播。AI 的每一行代码背后都隐含着它自己做出的设计选择，而这些选择从不经过审查。

问题不止于此：

- **开环执行**：发出指令，祈祷结果正确。没有反馈回路检测 AI 是否在正确的轨道上，直到最终交付。
- **多 session 失忆**：上下文窗口是硬约束。上一个 session 讨论了 40 分钟的架构决策，下一个 session 全部忘记，从零开始猜测。
- **多 agent 混沌**：4 个 agent 协作写代码，每个各自理解需求，输出不收敛。没有共享的 source of truth，只有各自的幻觉。

这些问题的共同根源是一个控制论概念：**系统缺乏反馈回路。** AI 在持续产出，但没有机制检测偏差、没有信号驱动纠偏、没有约束阻止漂移。

## Bonfire 的方法

Bonfire 不是更好的 prompt engineering，不是另一个 AI wrapper。它是一套**约束传播系统**——借鉴控制论的工程学科方法，让 AI coding 过程中的每个决策都可追溯、可审查、可冻结。

核心原则：**规划拥有语义，编码只拥有执行。**

```
用户需求
    │
    ▼
┌──────────┐     ┌─────────────────────────────────────┐
│  Stage A  │────▶│         Truth Surface                │
│  意图提取  │     │  (共享约束账本 — reference signal)   │
└──────────┘     │                                      │
                 │  PROPOSED → CHALLENGED → FROZEN      │
                 └──────┬───────────────────┬───────────┘
                        │                   │
           ┌────────────▼────┐    ┌─────────▼──────────┐
           │  Plan (B-J)     │    │  Code               │
           │                 │    │                     │
           │  D-Critique 攻击 │───▶│  Frozen handoff     │
           │  G-Red 找漏洞   │    │  逐 unit 实现       │
           │  G-Blue 防御    │    │  禁止发明决策        │
           │  H-Review 裁决  │    │                     │
           └────────┬────────┘    └─────────┬──────────┘
                    │                       │
                    │    reentry ◀───────────┘ 偏差 → 信号 → 纠偏
                    │
           ┌────────▼────────┐
           │  Achieve        │
           │  验收闭环        │
           └─────────────────┘
```

**高影响决策在规划阶段冻结，编码阶段禁止发明。** 这不是建议——是硬边界。Coder agent 遇到 handoff 未覆盖的决策时，不能自己做主，必须触发 reentry 回到规划阶段。

## 核心概念

### Truth Surface — 约束账本

所有决策的共享记录。每个条目都有生命周期：提出（PROPOSED）→ 被质疑（CHALLENGED）→ 冻结（FROZEN）或被取代（SUPERSEDED）。跨 session、跨 agent 持久化。不依赖任何人的记忆力。

### 阶段门控 — 闭环反馈

每个 stage 的输出必须通过验证才能进入下一阶段。truth-freeze gate 要求所有 PROPOSED 条目要么被冻结、要么被显式拒绝——不允许"忘记处理"。

### 对抗性审查 — 扰动注入

4 个 subagent 从不同角度审查同一个规划：D-Critique 攻击缺陷、G-Red 找安全和逻辑漏洞、G-Blue 防御并提出缓解方案、H-Review 做终审裁决。单一视角的审查看不到系统性盲点。

### 冻结语义 — 关注点分离

Frozen handoff 是编码阶段的**唯一输入**。它不是参考文档——是合约。哪些决策已经做出、哪些边界不可逾越、哪些低影响选择留给 coder 自行判断，全部写死在 handoff 中。

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

### 使用

在任意项目目录中启动 Claude Code：

```
/bonfire:pre     # 初始化案例，运行预处理与审批
/bonfire:plan    # 运行对抗性规划 pipeline（Stage B-J）
/bonfire:code    # 基于 frozen handoff 编码
/bonfire:achieve # 验收闭环
/bonfire:render  # 渲染 markdown bundle
```

### 卸载

```bash
cd bonfire
bash uninstall.sh
```

## Pipeline 概览

### Pre — Stage A

提取用户意图、验证 repo 事实、识别盲点。生成 truth surface 初始快照。**需要用户显式批准后才能进入规划。**

### Plan — Stage B 到 J

| Stage | 说明 |
|-------|------|
| B Divergence | 生成 3+ 方案，保留最优路径 |
| C Requirements | 分解需求单元，定义验收标准 |
| D Critique | D-Critique agent 攻击规划缺陷 |
| E Closure | 依赖链闭合 |
| F Probes | 可执行验证（repo 检查、脚本测试） |
| G Red-Blue | G-Red 找漏洞、G-Blue 防御、truth-freeze gate |
| H Review | 终审裁决：approve / reject / reentry |
| J Compile | 编译 frozen handoff |

### Code

Coder agent 逐 unit 实现，evaluator agent 逐 unit 验证。偏离 handoff 触发 reentry。

### Achieve

对照 acceptance semantics 逐条验证交付物。

## 项目结构

```
bonfire/
├── bin/            CLI 工具（30+ 命令）
├── skills/         5 个 skill（pre / plan / code / achieve / render）
├── agents/         10 个对抗性 subagent
├── references/     共享知识文档（playbook、quality bar）
├── schemas/        pipeline schema 定义
├── templates/      22 个 markdown 渲染模板
├── hooks/          dual-write hook（自动渲染）
├── tests/          114 tests, 0 failures
├── install.sh      安装脚本
└── uninstall.sh    卸载脚本
```

## 开发

```bash
node --test tests/*.js
```

## License

MIT
