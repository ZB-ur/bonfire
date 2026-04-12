# Bonfire

**AI coding 的根本问题不是代码写不好，而是决策不可控。**

当你让 AI 写一个复杂系统时，真正的风险不是语法错误或 bug——这些可以调试。真正的风险是 AI 在编码过程中悄悄做出了高影响的产品决策：选择了错误的架构、遗漏了关键约束、把模糊需求按自己的理解实现了。等你发现时，代码已经写了几千行，推倒重来的成本远超从头开始。

这是一个控制论问题：**系统的调节器（AI）缺乏反馈回路。** 它产出代码，但没有机制检测偏差、没有信号驱动纠偏、没有约束阻止漂移。

Bonfire 解决这个问题。

## 核心理念

### 问题：开环系统无法自我纠偏

传统 AI coding 工作流是开环的：

```
用户需求 → AI 编码 → 交付
```

中间没有检测点。AI 做出的每个决策——选哪个库、数据模型怎么设计、边界条件怎么处理——都是单向的。你无法区分"AI 正确理解了需求"和"AI 自信地误解了需求"。

### 解法：闭环控制 + 对抗性审查

Bonfire 将 AI coding 重构为闭环控制系统：

```
          ┌─────────────────────────────┐
          │     Truth Surface           │
          │  (约束账本 — 所有决策的     │
          │   生命周期记录)              │
          └──────┬──────────────┬───────┘
                 │              │
    ┌────────────▼──┐    ┌─────▼────────────┐
    │   规划阶段     │    │   编码阶段        │
    │  4 个对抗性    │───▶│  frozen handoff   │
    │  subagent 审查 │    │  逐 unit 实现     │
    └────────────┬──┘    └─────┬────────────┘
                 │              │
                 │   reentry    │ 偏差检测
                 │◀─────────────┘
                 │
          ┌──────▼──────────────────────┐
          │     Algedonic Signal        │
          │  (偏差 → 可见信号 → 纠偏)   │
          └─────────────────────────────┘
```

**三个控制论原则：**

1. **Truth Surface（决策账本）**：每个决策都有完整生命周期——PROPOSED → CHALLENGED → FROZEN。不是"AI 决定了什么"，而是"这个决策经过了谁的审查、被谁质疑、为什么最终冻结"。

2. **对抗性审查（Requisite Variety）**：D-Critique agent 攻击规划缺陷，G-Red agent 找漏洞，G-Blue agent 防御——然后 H-Review agent 做终审裁决。单一视角的审查无法发现系统性盲点，对抗性多视角可以。

3. **Algedonic Signal（警报信号）**：偏差不会被静默吸收。编码偏离 handoff → 触发 reentry 回到规划阶段。渲染字段缺失 → 产生可见错误标记。truth surface 冲突 → 阻塞推进。每个偏差都产生信号，驱动系统自我纠偏。

## 和"让 AI 直接写代码"有什么不同？

| | 直接 AI 编码 | Bonfire |
|--|-------------|---------|
| 决策控制 | AI 编码时隐式决策，用户事后审查 | 高影响决策在规划阶段显式冻结，编码阶段禁止发明 |
| 失败模式 | 发现问题时代码已写完，推倒重来 | reentry 机制在偏差发生时立即回退到对应阶段 |
| 需求理解 | 一次性理解，理解偏差无限放大 | 4 个对抗性 agent 从不同角度审查，盲点被系统性暴露 |
| 可追溯性 | 无——无法回答"为什么这样实现" | truth surface 记录每个决策的完整生命周期 |
| 约束保持 | 依赖 AI 记忆力（不可靠） | 约束冻结后成为 frozen constraint，编码阶段硬性校验 |

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

```bash
/bonfire:pre     # 初始化案例，运行预处理与审批
/bonfire:plan    # 运行对抗性规划 pipeline
/bonfire:code    # 基于 frozen handoff 编码
/bonfire:achieve # 验收闭环
```

### 卸载

```bash
cd bonfire
bash uninstall.sh
```

## Pipeline

```
pre (Stage A)  →  plan (Stage B-J)  →  code  →  achieve
```

### Pre — 提取意图，建立 truth surface

Stage A：提取用户意图、验证 repo 事实、识别盲点。生成 truth surface 初始快照。**需要用户显式批准后才能进入规划。**

### Plan — 对抗性规划（8 个 stage）

| Stage | 说明 |
|-------|------|
| B Divergence | 生成 3+ 方案，保留最优路径 |
| C Requirements | 分解为需求单元，定义验收标准 |
| D Critique | D-Critique agent 攻击规划缺陷 |
| E Closure | 依赖链闭合 |
| F Probes | 可执行验证（repo 检查、脚本测试） |
| G Red-Blue | G-Red 找漏洞，G-Blue 防御，truth-freeze gate |
| H Review | H-Review 终审裁决（approve / reject / reentry） |
| J Compile | 编译 frozen handoff（编码阶段的唯一输入） |

### Code — frozen handoff 驱动编码

Coder agent 逐 unit 实现，evaluator agent 逐 unit 验证。偏离 handoff 触发 reentry 回到规划阶段。Coder **禁止发明高影响产品决策**——这些在规划阶段已经冻结。

### Achieve — 验收闭环

对照 acceptance semantics 逐条验证交付物，生成最终裁定。

## 项目结构

```
bonfire/
├── bin/            CLI 工具（30+ 命令）
├── skills/         5 个 skill（pre/plan/code/achieve/render）
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
# 运行测试
node --test tests/*.js
```

## License

MIT
