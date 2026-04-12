# Bonfire

把 AI coding 从开环祈祷变成闭环工程。

## 问题

我们用 AI coding 做了三个项目。以下是真实发生的事情。

**Mosaicat — 德州扑克敏捷管理系统**

第一天，Claude 在没有得到许可的情况下生成了整个 codebase。代码看起来完整——文件结构清晰、逻辑连贯、甚至有测试。我们几乎就要在这个基础上继续开发了。但仔细检查后发现：状态机没有连接，核心流程跑不通。全删，只保留规划文档。

第二轮，我们设计了 13 个 agent 的 pipeline。73KB 的 prompt 生成了 105 个文件。编译通过，测试通过——但应用打开后什么都不能用。Tester 的自动化测试跑了 3 次都失败，原因却是文件系统错误（EISDIR），不是逻辑问题。**测试在验证"文件存不存在"，而不是"功能对不对"。**

更隐蔽的问题：UIDesigner 为了"风格一致性"，把前面生成的所有组件源码塞进 prompt 作为上下文。第 1 个组件 25KB prompt，到第 37 个组件膨胀到 88KB。后面的组件输出质量直线下降，有几个直接输出空白——核心布局组件被推到了 prompt 中间位置，恰好是模型注意力最弱的区域。

还有 GitHub 集成。终端日志显示 "creating issue... pushing PR"，一切看起来正常。但打开 GitHub 一看——repository 里什么都没有。**静默失败，没有任何信号告诉你出了问题。**

**AI Workstation — 飞书 + 多模型工作站**

需求说"接入飞书平台"。听起来简单。但飞书 IM、Docs、Bitable 是三个完全不同的 API 体系——需求里把它们当成了"一个平台"。OpenClaw 的配置 schema 和文档对不上（`Unrecognized key: autoApprove`）。模型切换了 4 次：Codex 超限、Gemini OAuth 失败、GLM 配置不清，最后 Kimi 才跑通。

交互设计基于飞书卡片按钮回调——但飞书按钮回调根本不能携带自由文本。整个交互方案建立在一个未验证的平台假设上。

**Detent — bonfire 的前身**

201 个 commit，9 个 phase。到最后：代码库膨胀到 6 大目录，每个新 session 里 Claude 的全局感知肉眼可见下降——改了 engine/ 的状态管理，没同步 commands/ 里的 skill；加了新 CLI 命令，没更新 web/ 里的 API route。

Roadmap 把核心理念（控制论编排）推到了 Phase 7，而 WebUI（最后砍掉一半功能）占了 31% 的工作量。AI 每个 plan 的产出都很完整，看不出偏离——feature creep 就这样一步步积累，直到项目不可挽救。

82 个 Playwright 结构测试全部通过。但点击按钮没有反应——WebUI 不能真正执行任何操作。**测试全绿，产品全废。**

最后我们放弃了 Detent，启动了 bonfire。

### 这些问题的共同根源

不是 AI 不够聪明。是整个工作流缺乏反馈回路。

- **开环执行**：发出指令，祈祷结果正确。没有机制检测 AI 是否在正确的轨道上，直到最终交付——然后发现要推倒重来。
- **决策静默漂移**：AI 在编码过程中持续做出产品决策（选什么架构、怎么处理边界、用什么数据模型），这些决策从不经过审查，从不可追溯。
- **上下文失控**：prompt 膨胀、跨 session 失忆、codebase 膨胀导致模型感知下降——"认知没有变成硬约束，执行时一定会丢"。
- **虚假验证**：测试通过 ≠ 功能正确。结构化测试验证的是文件存在性，不是行为正确性。静默失败没有 algedonic signal。

用控制论的语言说：**系统缺乏反馈回路。** AI 在持续产出，但没有机制检测偏差、没有信号驱动纠偏、没有约束阻止漂移。

## Bonfire 的方法

Bonfire 不是更好的 prompt engineering，不是另一个 AI wrapper。它是从三个项目的失败中提炼出的**约束传播系统**——用控制论的工程方法，让 AI coding 过程中的决策可追溯、可审查、可冻结。

核心原则：**规划拥有语义，编码只拥有执行。**

Barry Boehm 的变更成本曲线告诉我们：需求阶段的错误修一修就好，编码阶段修要花 10 倍代价。在 AI coding 时代，这条曲线更陡——因为 AI 让"重新生成一遍"看起来很便宜，但每次重新生成都在赌 AI 这次能做出正确的决策。

Bonfire 的回答是：**不要赌。把高影响决策从编码过程中提取出来，在规划阶段冻结。**

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

## 核心概念

### Truth Surface — 约束账本

Mosaicat 的教训：13 个 agent 各自理解需求，输出不收敛，没有共享的 source of truth。

Truth surface 是所有决策的共享记录。每个条目都有生命周期：PROPOSED → CHALLENGED → FROZEN / SUPERSEDED。跨 session、跨 agent 持久化。不依赖任何人的记忆力——包括 AI 的。

### 阶段门控 — 闭环反馈

Detent 的教训：82 个测试全绿，产品全废。验证的是结构，不是行为。

每个 stage 的输出必须通过验证才能进入下一阶段。Truth-freeze gate 要求所有 PROPOSED 条目要么被冻结、要么被显式拒绝——不允许"忘记处理"。

### 对抗性审查 — 扰动注入

AI 不会主动质疑你的方向——它会非常配合地在错误的路上陪你走很远。

4 个 subagent 从不同角度审查同一个规划：D-Critique 攻击缺陷、G-Red 找漏洞、G-Blue 防御并提出缓解方案、H-Review 做终审裁决。单一视角的审查看不到系统性盲点。

### 冻结语义 — 关注点分离

AI Workstation 的教训：交互设计建立在未验证的平台假设上，写完才发现飞书 API 不支持。

Frozen handoff 是编码阶段的**唯一输入**。不是参考文档——是合约。哪些决策已做出、哪些边界不可逾越、哪些选择留给 coder，全部写死。Coder agent 遇到未覆盖的高影响决策时，不能自己做主，必须触发 reentry 回到规划阶段。

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
