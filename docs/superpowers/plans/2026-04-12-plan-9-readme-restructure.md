# README Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite README.md to match the structure and content defined in the design spec.

**Architecture:** Single-file rewrite of README.md. No other files change. The new README reorganizes information by reader priority (what → how → why) instead of the current narrative order (why → what → how).

**Tech Stack:** Markdown

---

### Task 1: Rewrite README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace README.md with the new content**

Write the complete new README.md:

````markdown
# Bonfire

让 AI 在合约下写代码，而不是猜你想要什么。

Bonfire 解决的核心问题：AI 在编码过程中会静默做出大量产品决策（数据模型、边界处理、API 风格……），这些决策从不经过审查，也无法追溯。Bonfire 通过对抗性规划和冻结合约，把高影响决策锁定在规划阶段，编码阶段只负责执行。

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
/bonfire:pre     # 初始化案例，提取意图，人工审批
/bonfire:plan    # 对抗性规划（生成方案 → 攻击缺陷 → 红蓝对抗 → 冻结合约）
/bonfire:code    # 按冻结合约逐单元编码
/bonfire:achieve # 验收闭环
/bonfire:render  # 渲染 markdown 文档
```

### 卸载

```bash
cd bonfire
bash uninstall.sh
```

---

## 什么时候该用 Bonfire

**适合**：需求复杂、涉及多个模块的实现任务；跨多个 session 的大型开发；需要多人（或多 agent）协作且决策需要可追溯的场景。

**不适合**：一行 bug fix、快速原型探索、不需要规划的简单任务——这些场景 Bonfire 的流程开销大于收益。

---

## 核心理念

**规划拥有语义，编码只拥有执行。**

### 约束账本（Truth Surface）

每个产品决策都记录在共享的约束账本中，有明确的生命周期：提出 → 挑战 → 冻结。跨会话、跨 agent 共享，不依赖任何人的记忆力——包括 AI 的。

没有共享的事实来源，每个 agent 各自理解需求，结果就是各自偏各自的。

### 对抗性审查

AI 不会主动质疑你的方向。它会配合地在错误的路上陪你走很远。

Bonfire 用 4 个 agent 从不同角度审查同一份规划：攻击缺陷、找漏洞、提防御方案、终审裁决。规划在对抗中存活下来，实现时翻车的概率就低得多。

### 阶段门控

每个阶段的输出必须通过验证才能进入下一阶段。所有提出的约束要么被冻结、要么被显式拒绝——不允许"忘记处理"。质量校验前移，不是写完代码才发现方向错了。

### 冻结合约（Frozen Handoff）

编码阶段的唯一输入，不是参考文档，是合约。哪些决策已做出、哪些边界不可逾越、哪些低影响选择留给编码者，全部写死。遇到合约未覆盖的高影响决策？不能自己做主，触发回退重新规划。

---

## Pipeline 概览

```
┌──────────┐     ┌────────────────────────────┐
│  Pre     │────▶│  约束账本（Truth Surface）   │
│  意图提取 │     │                            │
└──────────┘     │  共享的、可冻结的决策记录     │
                 │  提出 → 挑战 → 冻结          │
                 └──────┬───────────┬──────────┘
                        │           │
              ┌─────────▼───┐  ┌────▼──────────┐
              │  Plan       │  │  Code          │
              │  对抗性规划   │  │  合约驱动编码   │
              │             │──▶│               │
              │  攻击、防御   │  │  逐单元实现     │
              │  冻结约束     │  │  禁止发明决策   │
              └──────┬──────┘  └────┬──────────┘
                     │              │
                     │  reentry ◀───┘
                     │
              ┌──────▼──────┐
              │  Achieve    │
              │  验收闭环    │
              └─────────────┘
```

### Pre — 意图提取与人工审批

**控制论角色：系统初始化 + reference signal 建立**

提取用户意图、验证仓库事实、识别盲点。输出写入约束账本作为种子数据。这是整个流程中唯一的强制人工审批点——确保起点准确，否则后续所有环节都在错误的目标上收敛。

### Plan — 对抗性规划

**控制论角色：扰动注入 + 约束冻结 + reference signal 精炼**

8 个阶段构成规划闭环：

1. **发散** — 生成多个方案，显式比较取舍，选最优路径
2. **需求分解** — 拆成可验证的需求单元，写入约束账本
3. **缺陷攻击** — 独立 agent 攻击规划中的假设和缺陷
4. **依赖闭合** — 理清约束之间的依赖关系，避免孤立约束
5. **实测验证** — 跑脚本、检查环境、验证关键假设（不是猜测）
6. **红蓝对抗** — 红方找漏洞，蓝方提防御，最后冻结约束
7. **终审裁决** — 综合所有证据做通过/拒绝/回退决策
8. **编译合约** — 生成冻结合约，作为编码阶段的唯一输入

### Code — 合约驱动编码

**控制论角色：受控执行 + 偏差检测 + reentry 反馈回路**

按冻结合约逐单元实现，每个单元有独立的验收条件。遇到合约未覆盖的高影响决策时触发回退，回到对应的规划阶段重新处理——这是 algedonic signal：偏差产生信号，信号驱动纠偏。回退深度有上限，超过阈值暂停并请求人工介入。

### Achieve — 验收闭环

**控制论角色：输出验证 + 闭环终止条件**

对照约束账本中的验收标准逐条验证交付物。每个标准都有明确的通过/不通过判定。

---

## 为什么需要 Bonfire

AI 编码工具经历了两代架构，各有天花板：

**第一代：人工驱动** — 用户写需求，AI 生成代码，人工审查。问题不是代码质量，而是 AI 在编码过程中静默做了大量产品决策（数据模型、边界处理、API 风格），这些决策从不经过审查。你无法区分"AI 正确理解了需求"和"AI 自信地误解了需求"，直到打开应用才发现。没有反馈回路。

**第二代：流水线驱动** — 多个 agent 组成 pipeline，分工协作。本质上仍然是开环的：agent 之间的理解偏差单向传播、逐级放大，没有共享的事实来源，没有纠偏机制。我们的 [Mosaicat](https://github.com/ZB-ur/mosaicat) 就是这么翻的：13 agent pipeline 跑完全绿，打开应用一片空白。

两代的共同问题：决策在错误的层级发生（编码阶段而非规划阶段），认知没有持久化为硬约束，验证停留在表面（编译通过不等于能用）。

Bonfire 的回应是把 AI 编码重构为闭环控制系统：共享的约束账本作为 reference signal，对抗性审查提供 requisite variety，阶段门控实现质量前移，冻结合约将规划决策变成编码硬约束。

---

## 项目结构

```
bonfire/
├── skills/         5 个 skill（pre / plan / code / achieve / render）
├── agents/         10 个对抗性 subagent
├── references/     共享知识文档
├── schemas/        pipeline schema 定义
├── templates/      22 个 markdown 渲染模板
├── hooks/          dual-write hook（自动渲染）
├── bin/            CLI 工具入口
├── tests/          114 tests, 0 failures
├── install.sh      安装脚本
└── uninstall.sh    卸载脚本
```

## 开发

```bash
node --test tests/*.js
```

## 参考文献

Bonfire 的设计借鉴了控制论和软件工程领域的经典工作：

- Wiener, N. (1948). *Cybernetics.* — 控制论基础，闭环控制的理论框架
- Ashby, W.R. (1956). *An Introduction to Cybernetics.* — requisite variety 法则
- Beer, S. (1972). *Brain of the Firm.* — viable system model, algedonic signal
- Boehm, B. (1981). *Software Engineering Economics.* — 变更成本曲线
- Forsgren, N. et al. (2018). *Accelerate.* — DORA 研究，质量前移
- Fowler, M. (2005). *Event Sourcing.* — 约束账本的架构参考
- Liu, N.F. et al. (2023). *Lost in the Middle.* — 长上下文注意力衰减

## License

MIT
````

- [ ] **Step 2: Verify the README renders correctly**

Run: `cat -n README.md | head -20`
Expected: First 20 lines show the new header and tagline, properly formatted.

- [ ] **Step 3: Verify spec coverage**

Check each spec section against the new README:
1. Opening tagline: "让 AI 在合约下写代码，而不是猜你想要什么" ✓
2. Quick start moved to position 2 ✓
3. Usage fit section (new) ✓
4. Core principles (4 concepts) ✓
5. Pipeline overview with ASCII diagram and cybernetics role annotations ✓
6. "Why Bonfire" compressed with Mosaicat one-liner ✓
7. Project structure with corrected bin/ description ✓
8. References trimmed to 7, sorted by theme ✓
9. Terminology: cybernetics terms in English, rest in Chinese ✓

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: restructure README — reader-priority ordering, compressed problem section"
```
