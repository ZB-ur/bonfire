# Bonfire

把 AI coding 从开环祈祷变成闭环工程。

---

## 问题

我们用 AI coding 连续做了三个项目。每个项目都教了我们一课。

### Mosaicat — 13 个 agent 的华丽溃败

[Mosaicat](https://github.com/ZB-ur/mosaicat) 是一条 Spec Coding pipeline：一句话需求进去，13 个 AI agent 流水线处理（意图顾问 → 产品经理 → UX → API → UI → 技术主管 → QA → 程序员 → 测试 → 安全审计 → 评审 → 验收），完整代码出来。听起来很美。

**Day 1：Automation Bias 首秀。** Claude 没等我们说"开始"就把整个 codebase 写完了。代码看起来无比专业——命名规范、结构清晰、甚至有单元测试。我们差点就在这个基础上继续开发了。但仔细一看：状态机压根没连上，核心流程跑不通。Parasuraman & Riley (1997) 说的 automation bias——人类倾向于过度信任自动化系统的输出——在 AI coding 时代被放大了一个数量级。*全删，只保留规划文档。*

**Round 2：编译通过 ≠ 能用。** 73KB prompt，105 个文件。`npm run build` 通过，测试通过，打开应用——一片空白。Tester 的自动化测试连跑 3 次全挂，原因是 `EISDIR`，跟逻辑正确性毫无关系。Barr et al. (2014) 称之为 Test Oracle Problem：**定义"什么叫正确"比运行测试难得多。** 我们的测试在验证"文件存不存在"，没人在验证"功能对不对"。

**Context 膨胀致死。** UIDesigner 为了风格统一，把前面生成的所有组件源码塞进 prompt。第 1 个组件 25KB，到第 37 个膨胀到 88KB。后面的组件质量断崖式下跌，有几个直接输出空白。原因是 Liu et al. (2023) 的 Lost in the Middle 效应：核心布局组件被挤到 prompt 正中间，恰好是模型注意力的死区。

**静默失败，零信号。** GitHub 集成的终端日志信誓旦旦地打印 `creating issue... pushing PR...`，仪式感拉满。打开 GitHub：空的。Charity Majors (2022) 区分了 monitoring 和 observability——我们有前者（"跑完了吗？"），完全没有后者（"每一步到底发生了什么？"）。

### AI Workstation — 建在流沙上的平台

需求写"接入飞书平台"。五个字，三个坑。飞书 IM、Docs、Bitable 是三套完全不同的 API 体系，需求里把它们当成同一个东西。Clayton Christensen 的 JTBD 理论说得对：**需求应该用约束定义，不是用方案定义。** "用飞书"是方案，"需要群消息推送 + 文档读写 + 结构化数据存储"才是约束。

交互方案基于飞书卡片按钮回调。设计做完了，代码写完了，一测试：飞书按钮回调不能携带自由文本。**整个交互层建在一个从未验证的平台假设上。** 做交互设计前应该先做 assumption mapping——把所有隐含假设列出来，逐条验证，再动手。

### Detent — 201 个 commit 的方向债

Detent 是 bonfire 的前身。201 个 commit，9 个 phase。我们想做控制论驱动的 AI coding pipeline。实际做出来的是：6 大目录的代码库、一个占了 31% 工作量但最后砍掉一半功能的 WebUI、以及被推到 Phase 7 才认真对待的"核心理念"。

Fred Brooks (1975) 的第二系统效应在 AI coding 时代变异了：AI 让每个 plan 的产出都很完整，看不出偏离。Feature creep 像温水煮青蛙，一步步把项目推离核心目标。我们管这叫**方向债（direction debt）**——技术债有利息但可以还清，方向债复利到项目破产。

到后期，每开一个新 session，Claude 对项目的感知就差一点：改了 `engine/` 的状态管理，忘了同步 `commands/`；加了新 CLI 命令，忘了更新 `web/` 的路由。Liu et al. 的 Lost in the Middle 从 prompt 级蔓延到了项目级——codebase 超过了模型的有效处理范围。

收尾时跑了 82 个 Playwright 测试，全绿。然后我们点了一下按钮——没反应。Martin Fowler (2012) 的测试金字塔说得很清楚：你不能只有底层的结构测试，顶层的 E2E 行为测试不可或缺。**82 个测试验证的是 DOM 结构，不是用户行为。测试全绿，产品全废。**

我们放弃了 Detent。

---

## 诊断：为什么 vibe coding 必然翻车

三个项目的失败不是偶然。用 Norbert Wiener (1948) 的控制论框架分析，它们共享同一个结构性缺陷：

### 1. 开环系统无法自我纠偏

```
prompt → AI 编码 → 交付（祈祷）
```

没有反馈回路。AI 在持续产出，但没有机制检测偏差、没有信号驱动纠偏。你无法区分"AI 正确理解了需求"和"AI 自信地误解了需求"。Ashby (1956) 的 Requisite Variety 法则说：**控制器的多样性必须大于等于被控系统的多样性。** 单一 prompt 的控制力远远不够。

### 2. 决策在错误的层级发生

Barry Boehm (1981) 的变更成本曲线：需求阶段修一修就好，编码阶段修 10 倍，上线后 100 倍。AI coding 时代这条曲线更陡——因为"让 AI 重写一遍"感觉很便宜，但每次重写都在赌 AI 这次能做对。Mosaicat 赌了三轮，每轮都输。

**高影响决策应该在规划阶段做出，不是在编码过程中被 AI 悄悄决定。**

### 3. 认知没有变成硬约束

Peter Senge (1990) 的动态复杂性理论：系统问题不是一次性暴露的，而是逐层展开。你在 session 1 讨论了 40 分钟的架构决策，到 session 5 它已经从 AI 的上下文里消失了。Meta REALM (2020) 和 Lewis et al. (2020) 的 RAG 研究反复证实：**context quality > model quality。** 喂给模型的内容质量比模型本身能力更重要。

### 4. 虚假验证 = 虚假安全感

编译通过 ≠ 能用。测试通过 ≠ 正确。日志说成功 ≠ 真的成功。Forsgren et al. (2018) 的 DORA 研究指出：高效能团队把质量校验前移（shift-left），而不是在 pipeline 末端堆检查。每一层都可能在骗你——而且骗得很有仪式感。

---

## Bonfire 的方法

Bonfire 是我们交了三个项目的学费后提炼出的**约束传播系统**。不是更好的 prompt engineering，不是另一个 AI wrapper。它借鉴了 Stafford Beer (1972) 的 Viable System Model，将 AI coding 重构为闭环控制系统：

```
用户需求
    │
    ▼
┌──────────┐     ┌────────────────────────────────────────┐
│  Stage A  │────▶│  Truth Surface (约束账本)               │
│  意图提取  │     │                                        │
└──────────┘     │  共享的、可冻结的 reference signal      │
                 │  PROPOSED → CHALLENGED → FROZEN         │
                 └──────┬────────────────────┬─────────────┘
                        │                    │
           ┌────────────▼────┐     ┌─────────▼──────────┐
           │  Plan (B-J)     │     │  Code               │
           │                 │     │                     │
           │  D-Critique 攻击 │────▶│  Frozen handoff     │
           │  G-Red 找漏洞   │     │  逐 unit 实现       │
           │  G-Blue 防御    │     │  禁止发明决策        │
           │  H-Review 裁决  │     │                     │
           └────────┬────────┘     └─────────┬──────────┘
                    │                        │
                    │  reentry ◀──────────────┘
                    │  偏差 → algedonic signal → 纠偏
                    │
           ┌────────▼────────┐
           │  Achieve        │
           │  验收闭环        │
           └─────────────────┘
```

核心原则：**规划拥有语义，编码只拥有执行。**

### Truth Surface — 约束账本

Mosaicat 的教训：13 个 agent 各自理解需求，没有共享的 source of truth——只有各自的幻觉。

Truth surface 是所有决策的共享记录，类比控制系统中的 reference signal。每个条目都有生命周期（PROPOSED → CHALLENGED → FROZEN / SUPERSEDED），跨 session、跨 agent 持久化。架构参考了 Martin Fowler (2005) 的 Event Sourcing：agent 的提议是 event，约束账本是 projection，history 是 audit trail。

### 对抗性审查 — Requisite Variety 的实践

AI 不会主动质疑你的方向。它会非常配合地在错误的路上陪你走很远，而且走得很快。

Ashby 的 Requisite Variety 法则要求控制器的多样性匹配被控系统。单一审查视角不够——所以我们用 4 个 subagent 从不同角度审查同一个规划：D-Critique 攻击缺陷、G-Red 找漏洞、G-Blue 防御并提出缓解、H-Review 做终审裁决。对抗性评审是扰动注入——如果规划在红蓝对抗中存活下来，在真实实现中翻车的概率就低得多。

### 阶段门控 — 闭环反馈

Detent 的教训：82 个测试全绿，产品全废。

每个 stage 的输出必须通过验证才能进入下一阶段——这是 Forsgren et al. 说的 shift-left。Truth-freeze gate 要求所有 PROPOSED 条目要么被冻结、要么被显式拒绝。不允许"忘记处理"。

### 冻结语义 — Parent-as-Sole-Writer

Detent 的另一个教训：多 agent 同时写入 truth surface，产生并发冲突，5 条约束卡在 PROPOSED 状态没人处理。

解法借鉴了 Beer 的 VSM 中 System 1（执行）与 System 3（内部调节）的关系：**执行层不能直接修改约束层，只能提议。** Agent 产出 JSON delta，父模型（orchestrator）作为唯一写入者统一执行——类似 Redux 的单向数据流，或 Git 的 commit 模型。Frozen handoff 是编码阶段的唯一输入，不是参考文档，是合约。

---

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

```
pre (Stage A)  →  plan (Stage B-J)  →  code  →  achieve
```

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

Coder agent 逐 unit 实现，evaluator agent 逐 unit 验证。偏离 handoff 触发 reentry 回到规划阶段。

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

## 参考文献

- Ashby, W.R. (1956). *An Introduction to Cybernetics.* — Requisite Variety 法则
- Barr, E.T. et al. (2014). *The Oracle Problem in Software Testing.* — Test Oracle Problem
- Beer, S. (1972). *Brain of the Firm.* — Viable System Model
- Boehm, B. (1981). *Software Engineering Economics.* — 变更成本曲线
- Brooks, F. (1975). *The Mythical Man-Month.* — 第二系统效应、通信复杂度
- Forsgren, N. et al. (2018). *Accelerate.* — DORA 研究、shift-left testing
- Fowler, M. (2005). *Event Sourcing.* — Event Sourcing 模式
- Fowler, M. (2012). *TestPyramid.* — 测试金字塔
- Liu, N.F. et al. (2023). *Lost in the Middle.* — 长上下文注意力衰减
- Majors, C. et al. (2022). *Observability Engineering.* — Monitoring vs. Observability
- Parasuraman, R. & Riley, V. (1997). *Humans and Automation.* — Automation Bias
- Senge, P. (1990). *The Fifth Discipline.* — 动态复杂性
- Wiener, N. (1948). *Cybernetics.* — 控制论基础

## License

MIT
