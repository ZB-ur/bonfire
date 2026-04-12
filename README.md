# Bonfire

把 AI coding 从开环祈祷变成闭环工程。

---

## 问题：AI coding 的三代架构和各自的天花板

### 第一代：Vibe Coding — 人工开环

```
用户 prompt → AI 生成代码 → 人工审查 → 手动修正 → 重复
```

这是大多数人今天在做的事情。你写一段需求，AI 给你一坨代码，你肉眼看看"大概对"就往下走。

问题不是 AI 写的代码不好——语法正确、命名规范、甚至有注释。问题是 **AI 在编码过程中静默做了几十个产品决策**：用什么数据模型、怎么处理边界、选哪个 API 风格、用 REST 还是 GraphQL。这些决策从不经过审查、从不可追溯。你以为它在"实现你的需求"，其实它在"实现它对你需求的猜测"。

Parasuraman & Riley (1997) 称之为 automation bias：人类倾向于过度信任自动化输出。AI 生成的代码结构清晰、风格统一、看起来很专业——于是你信了。直到打开应用发现核心流程跑不通。

**根本缺陷：没有反馈回路。** 你无法区分"AI 正确理解了需求"和"AI 自信地误解了需求"，直到为时已晚。

### 第二代：Harness 框架 — 流水线开环

```
需求 → Agent 1 → Agent 2 → ... → Agent N → 代码
```

Mosaicat、Cursor Composer、Devin、各种 multi-agent framework——思路都是一样的：把工作拆给多个 agent，组成流水线。看起来从"一步到位"进化到了"分工协作"。

但本质上仍然是开环的。Agent 1 的理解偏差传递给 Agent 2，Agent 2 在偏差基础上继续偏。Fred Brooks (1975) 的通信复杂度公式 `n(n-1)/2` 告诉你：13 个 agent 有 78 条潜在失败路径。更糟的是，这些失败是**静默的**——pipeline 跑完了，日志显示成功，打开一看什么都不能用。

[我们的 Mosaicat](https://github.com/ZB-ur/mosaicat) 就是这么翻车的：13 个 agent 的 Spec Coding pipeline，73KB prompt 生成 105 个文件，`npm run build` 通过，测试通过，打开应用——一片空白。Barr et al. (2014) 的 Test Oracle Problem：**定义"什么叫正确"比运行测试难得多。**

**根本缺陷：有流水线但没有反馈回路。** 每个 agent 各自理解需求，没有共享的 source of truth。错误在 pipeline 中单向传播、逐级放大，没有任何机制检测和纠偏。

### 第三代需要什么？闭环控制

用 Norbert Wiener (1948) 的控制论框架看，前两代的共同问题是：

1. **开环执行**：没有反馈回路。Ashby (1956) 的 Requisite Variety 法则说控制器的多样性必须 ≥ 被控系统的多样性。单一 prompt 或单向 pipeline 的控制力远远不够。

2. **决策在错误的层级发生**：Barry Boehm (1981) 的变更成本曲线——需求阶段修 1x，编码阶段修 10x。AI 让"重写一遍"感觉很便宜，但每次重写都在赌它这次做对。高影响决策应该在规划阶段冻结，不是在编码过程中被 AI 悄悄决定。

3. **认知没有变成硬约束**：你在 session 1 讨论了 40 分钟的架构决策，session 5 它已经忘了。Peter Senge (1990) 的动态复杂性 + Liu et al. (2023) 的 Lost in the Middle——context quality > model quality。

4. **虚假验证**：编译通过 ≠ 能用，测试通过 ≠ 正确，日志说成功 ≠ 真的成功。Forsgren et al. (2018) 的 DORA 研究：高效能团队 shift-left，把质量校验前移，而不是在末端堆检查。

---

## Bonfire 的方法

Bonfire 是我们交了三个项目学费后提炼出的**约束传播系统**。不是更好的 prompt engineering，不是另一个 multi-agent framework。它借鉴 Stafford Beer (1972) 的 Viable System Model，将 AI coding 重构为闭环控制系统：

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

### Truth Surface — 共享约束账本

前两代的通病：每个 agent（或每个 session）各自理解需求，没有共享的 source of truth——只有各自的幻觉。

Truth surface 是所有决策的持久化记录，类比控制系统中的 **reference signal**。每个条目都有完整生命周期：PROPOSED → CHALLENGED → FROZEN / SUPERSEDED。跨 session、跨 agent 共享。架构参考 Martin Fowler (2005) 的 Event Sourcing：agent 的提议是 event，约束账本是 projection，history 是 audit trail。不依赖任何人的记忆力——包括 AI 的。

### 对抗性审查 — Requisite Variety 实践

AI 不会主动质疑你的方向。它会非常配合地在错误的路上陪你走很远，而且走得很快。

Ashby 的法则要求控制器的多样性匹配被控系统。单一视角不够——4 个 subagent 从不同角度审查同一个规划：D-Critique 攻击缺陷、G-Red 找漏洞、G-Blue 防御并提缓解、H-Review 终审裁决。这是**扰动注入**——如果规划在红蓝对抗中存活下来，真实实现中翻车的概率就低得多。

### 阶段门控 — Shift-Left 闭环

前两代把验证放在末端：代码写完了才发现方向错了。

Bonfire 每个 stage 的输出必须通过验证才能进入下一阶段。Truth-freeze gate 要求所有 PROPOSED 条目要么被冻结、要么被显式拒绝——不允许"忘记处理"。这是 Forsgren et al. 说的 shift-left：质量前移。

### Parent-as-Sole-Writer — 并发控制

多 agent 同时写入共享状态会产生并发冲突。借鉴 Beer 的 VSM 中 System 1（执行）与 System 3（内部调节）的关系：**执行层不能直接修改约束层，只能提议。** Agent 产出 JSON delta，父模型作为唯一写入者统一执行——类似 Redux 单向数据流或 Git commit 模型。

### Frozen Handoff — 编码合约

Frozen handoff 是编码阶段的**唯一输入**，不是参考文档，是合约。哪些决策已做出、哪些边界不可逾越、哪些低影响选择留给 coder，全部写死。遇到未覆盖的高影响决策？不能自己做主，触发 reentry 回到规划。

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

---

## Pipeline 详解

```
pre (Stage A)  →  plan (Stage B-J)  →  code  →  achieve
```

### Pre — 意图提取与人工审批门

**控制论角色：系统初始化 + reference signal 建立**

Stage A 做三件事：提取用户意图、验证 repo 事实（不是猜测——是实际 `ls`、`cat`、`git log`）、识别盲点。输出写入 truth surface 作为约束账本的种子数据。

关键设计：**人工审批门（approval gate）**。Stage A 产出必须经过用户显式批准才能进入规划。这是整个 pipeline 中唯一的强制人工介入点——确保 reference signal 从一开始就是准确的。错误的 reference signal 会让后面所有闭环控制都在错误的目标上精确收敛。

### Plan — 对抗性规划 pipeline

**控制论角色：扰动注入 + 约束冻结 + reference signal 精炼**

8 个 stage 构成规划阶段的闭环。每个 stage 从不同角度增加系统的约束精度：

| Stage | 做什么 | 解决什么问题 | 控制论对应 |
|-------|--------|-------------|-----------|
| **B Divergence** | 生成 3+ 方案，显式比较 tradeoff，保留最优路径 | 防止路径锁定——第一个想到的方案不一定最好 | **Variety amplification**：先扩大解空间，再收敛 |
| **C Requirements** | 分解需求单元，每个单元定义验收标准，写入 truth surface | 需求模糊导致 AI 自行填补——把"意会"变成"言传" | **Reference signal 精炼**：从抽象目标到可验证约束 |
| **D Critique** | D-Critique agent 攻击规划缺陷，挑战未验证的假设 | 单一视角的规划看不到自身盲点 | **扰动注入第一轮**：在受控环境中暴露脆弱性 |
| **E Closure** | 闭合依赖链——哪个约束依赖哪个事实，连成图 | 孤立的约束不可靠：A 依赖 B，B 被推翻，A 也应该失效 | **依赖传播**：约束不是独立的，是网络 |
| **F Probes** | 可执行验证：跑脚本、检查 repo、测试环境、验证 API 假设 | AI Workstation 的教训：交互建在未验证的平台假设上 | **实测 vs 推测**：在规划阶段就验证关键假设 |
| **G Red-Blue** | G-Red 攻击（找漏洞），G-Blue 防御（提缓解），truth-freeze gate | D-Critique 是单人挑战，Red-Blue 是对抗性博弈——更强的压力测试 | **Requisite Variety**：多视角对抗确保鲁棒性 |
| **H Review** | 终审裁决：approve / reject / reentry | 需要一个最终决策者综合所有证据做判断 | **System 5 决策**：Beer VSM 的策略层 |
| **J Compile** | 编译 frozen handoff——编码阶段的唯一输入合约 | 将分散的约束、决策、依赖关系编译成 coder 可执行的单一文档 | **Reference signal → control signal**：从"什么是对的"到"怎么做" |

### Code — Frozen Handoff 驱动编码

**控制论角色：受控执行 + 偏差检测 + reentry 反馈回路**

Coder agent 按 implementation unit 逐个实现。每个 unit 有明确的输入（frozen handoff 中的合约）、验收条件和依赖关系。Evaluator agent 逐 unit 验证。

关键机制：**reentry**。编码过程中发现 handoff 未覆盖的高影响决策时，不能自己做主——触发 reentry 回到对应的规划 stage 重新处理。这是 Stafford Beer 的 **algedonic signal**：偏差产生可见信号，信号驱动系统纠偏。不是静默失败，不是自行发明，是显式地"这里有问题，需要回去重新规划"。

Reentry 深度有上限。超过阈值时系统暂停，请求人类介入——避免无限循环。

### Achieve — 验收闭环

**控制论角色：输出验证 + 闭环终止条件**

对照 truth surface 中的 acceptance semantics 逐条验证交付物。不是"看起来完成了"，是每个验收标准都有明确的通过/不通过判定。整个 pipeline 从人工审批（Stage A）开始，到验收确认结束——完整的闭环。

---

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
- Beer, S. (1972). *Brain of the Firm.* — Viable System Model, Algedonic Signal
- Boehm, B. (1981). *Software Engineering Economics.* — 变更成本曲线
- Brooks, F. (1975). *The Mythical Man-Month.* — 通信复杂度 n(n-1)/2
- Forsgren, N. et al. (2018). *Accelerate.* — DORA 研究, Shift-Left Testing
- Fowler, M. (2005). *Event Sourcing.* — Event Sourcing 模式
- Liu, N.F. et al. (2023). *Lost in the Middle.* — 长上下文注意力衰减
- Parasuraman, R. & Riley, V. (1997). *Humans and Automation.* — Automation Bias
- Senge, P. (1990). *The Fifth Discipline.* — 动态复杂性
- Wiener, N. (1948). *Cybernetics.* — 控制论基础

## License

MIT
