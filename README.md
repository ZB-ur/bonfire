# Bonfire

把 AI coding 从开环祈祷变成闭环工程。

## 问题

我们用 AI coding 连续做了三个项目。每个项目都教会我们一些关于"为什么 vibe coding 迟早会翻车"的事情。

**[Mosaicat](https://github.com/ZB-ur/mosaicat) — Spec Coding pipeline**

一句话需求进去，完整代码出来。13 个 AI agent 排成流水线：意图顾问 → 产品经理 → UX → API → UI → 技术主管 → QA → 程序员 → 测试 → 安全审计 → 评审 → 验收。听起来很美。

然后现实开始教做人。

Day 1，Claude 没等我们说"开始"就把整个 codebase 写完了。代码看起来无比专业——文件结构清晰、命名规范、甚至有单元测试。我们差点就在这个基础上继续开发。但仔细一看：状态机压根没连上，核心流程跑不通。*全删。*

第二轮老实了，搞了完整的 13 agent pipeline。73KB prompt 喂进去，105 个文件吐出来。`npm run build` 通过，测试通过——打开应用，一片空白。Tester 的自动化测试连跑 3 次全挂，原因是文件系统错误 `EISDIR`，跟逻辑正确性半毛钱关系没有。**测试在验证"文件在不在"，没有人验证"东西能不能用"。**

UIDesigner 更离谱：为了"组件风格统一"，它把前面生成的所有组件源码塞进每次 prompt。第 1 个组件 prompt 25KB，到第 37 个膨胀到 88KB。后面的组件质量断崖式下跌，有几个直接输出空白——因为最早写的核心布局组件被挤到了 prompt 中间，正好是模型注意力的盲区（Lost in the Middle，你好）。

最精彩的是 GitHub 集成。终端日志信誓旦旦地打印 `creating issue... pushing PR...`，仪式感拉满。打开 GitHub：空的。**静默失败，零信号。你以为一切正常，其实什么都没发生。**

**AI Workstation — 飞书 + 多模型工作站**

需求写"接入飞书平台"。五个字，三个坑。飞书 IM、Docs、Bitable 是三套完全不同的 API 体系，需求里把它们当成了同一个东西。OpenClaw 配置 schema 跟文档对不上（`Unrecognized key: autoApprove`——文档说有这个字段，运行时说没有）。模型切换了 4 次：Codex 超限 → Gemini OAuth 挂了 → GLM 配置不清 → Kimi 终于跑通。

交互方案基于飞书卡片按钮回调。设计做完了，代码写完了，一测试：飞书按钮回调不能携带自由文本。**整个交互层建在一个从未验证过的平台假设上。**

**Detent — bonfire 的前身**

201 个 commit，9 个 phase。我们想做的是"控制论驱动的 AI coding pipeline"。实际做出来的是：6 大目录的代码库、一个占了 31% 工作量但最后砍掉一半功能的 WebUI、以及一个被推到 Phase 7 才认真对待的"核心理念"。

AI 的每个 plan 都产出得很漂亮。文档完整、逻辑自洽、看起来毫无问题。但就是这种"看起来没问题"最要命——feature creep 像温水煮青蛙，一步步把项目推向不可挽救。

到后期，每开一个新 session，Claude 对项目的感知就肉眼可见地差一点：改了 `engine/` 的状态管理，忘了同步 `commands/` 里的 skill；加了新 CLI 命令，忘了更新 `web/` 的 API route。项目 codebase 已经超过了模型的有效处理范围。

收尾时跑了 82 个 Playwright 测试，全绿。然后我们点了一下按钮——没反应。WebUI 不能真正执行任何操作。**82 个测试验证的是 DOM 结构，不是用户行为。测试全绿，产品全废。**

我们放弃了 Detent。

### 这些故事的共同主题

不是 AI 不够聪明——Claude 写的每一行代码都语法正确、风格统一、甚至有注释。问题在别处：

- **开环执行**：prompt 发出去了，然后呢？祈祷。没有反馈回路告诉你 AI 在正确的方向上，直到交付那一刻你才知道——通常是推倒重来的那一刻。
- **决策静默漂移**：AI 在写代码的同时悄悄做了几十个产品决策（用什么数据模型、怎么处理边界、选哪个 API 风格），没有一个经过审查。你以为它在"实现你的需求"，其实它在"实现它对你需求的猜测"。
- **上下文失控**：prompt 膨胀、session 断裂、codebase 膨胀——三座大山。"认知没有变成硬约束，执行时一定会丢。"
- **虚假验证**：编译通过 ≠ 能用。测试通过 ≠ 正确。日志说成功 ≠ 真的成功。每一层都可能在骗你，而且骗得很有仪式感。

用控制论的话说：**系统没有反馈回路。** AI 在持续产出，但没有机制检测偏差、没有信号驱动纠偏、没有约束阻止漂移。

## Bonfire 的方法

Bonfire 不是更好的 prompt engineering，不是另一个 AI wrapper。它是我们交了三个项目的学费之后提炼出的**约束传播系统**——用控制论的工程方法，让 AI coding 过程中的决策可追溯、可审查、可冻结。

核心原则：**规划拥有语义，编码只拥有执行。**

Barry Boehm 的变更成本曲线说：需求阶段错了修一修就好，编码阶段修要 10 倍代价。AI coding 时代这条曲线更陡——因为"让 AI 重写一遍"感觉很便宜，但每次重写都在赌它这次能做对。Mosaicat 赌了三轮，每轮都输了。

Bonfire 的回答：**不赌。把高影响决策从编码过程中拎出来，在规划阶段用对抗性审查冻结。编码阶段只执行，不发明。**

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

Mosaicat 的教训：13 个 agent 各自理解需求，输出不收敛，没有共享的 source of truth——只有各自的幻觉。

Truth surface 是所有决策的共享记录。每个条目都有生命周期：PROPOSED → CHALLENGED → FROZEN / SUPERSEDED。跨 session、跨 agent 持久化。不依赖任何人的记忆力——包括 AI 的。

### 阶段门控 — 闭环反馈

Detent 的教训：82 个测试全绿，产品全废。验证的是 DOM 结构，不是用户行为。

每个 stage 的输出必须通过验证才能进入下一阶段。Truth-freeze gate 要求所有 PROPOSED 条目要么被冻结、要么被显式拒绝——不允许"忘记处理"。

### 对抗性审查 — 扰动注入

三个项目共同的教训：AI 不会主动质疑你的方向。它会非常配合地在错误的路上陪你走很远，而且走得很快。

4 个 subagent 从不同角度审查同一个规划：D-Critique 攻击缺陷、G-Red 找漏洞、G-Blue 防御并提出缓解方案、H-Review 做终审裁决。单一视角审不出系统性盲点。

### 冻结语义 — 关注点分离

AI Workstation 的教训：交互方案建在未验证的平台假设上，代码全写完了才发现飞书 API 不支持。

Frozen handoff 是编码阶段的**唯一输入**。不是参考文档——是合约。哪些决策已做出、哪些边界不可逾越、哪些选择留给 coder，全部写死。遇到未覆盖的高影响决策？不能自己做主，触发 reentry 回到规划。

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
