# Bonfire

基于控制论原理的 Claude Code 开发 pipeline。通过约束驱动的规划、对抗性审查、frozen handoff 和验收闭环，确保 AI 编码过程中的高影响决策不被遗漏或误判。

## 前置要求

- **Node.js 22+**
- **Claude Code** (需要有效订阅)

## 快速开始

```bash
# 安装
git clone https://github.com/ZB-ur/bonfire.git
cd bonfire
bash install.sh

# 卸载
bash uninstall.sh
```

安装后，在任意项目目录中启动 Claude Code，输入 `/bonfire:pre` 开始。

## Pipeline 概览

Bonfire 将开发流程分为 4 个阶段，共 10 个 stage：

```
pre (Stage A)  →  plan (Stage B-J)  →  code  →  achieve
```

### Pre — 预处理与审批

Stage A：提取用户意图、验证 repo 事实、识别盲点，生成 truth surface 初始快照。需要用户显式批准后才能进入规划阶段。

### Plan — 规划 Pipeline

8 个 stage 的对抗性规划流程：

| Stage | 名称 | 说明 |
|-------|------|------|
| B | Divergence | 生成 3+ 方案，保留最优路径 |
| C | Requirements | 分解为需求单元，定义验收标准 |
| D | Critique | 对抗性审查（subagent） |
| E | Closure | 依赖链闭合 |
| F | Probes | 可执行验证（repo 检查、脚本测试） |
| G | Red-Blue | 红蓝对抗 + truth-freeze gate |
| H | Review | 终审裁决（approve/reject/reentry） |
| J | Compile | 编译 frozen handoff |

### Code — 编码执行

基于 frozen handoff 逐 unit 实现。coder agent 执行、evaluator agent 验证。偏离 handoff 触发 reentry 回到规划阶段。

### Achieve — 验收闭环

对照 acceptance semantics 逐条验证交付物，生成最终裁定。

## 可用命令

| 命令 | 说明 |
|------|------|
| `/bonfire:pre` | 初始化案例，运行 Stage A 预处理 |
| `/bonfire:plan` | 运行 Stage B-J 规划 pipeline |
| `/bonfire:code` | 执行 frozen handoff 编码 |
| `/bonfire:achieve` | 验收确认 |
| `/bonfire:render` | 渲染 markdown bundle |

## 核心机制

### Truth Surface

约束账本（constraint ledger）记录所有决策的生命周期：PROPOSED → CHALLENGED → FROZEN / SUPERSEDED。每个条目都有可追溯的来源和审查历史。

### Reentry

当编码阶段发现规划缺陷时，系统自动回退到对应的规划 stage 重新执行，而不是让 coder 自行发明解决方案。Reentry 深度超过阈值时暂停并请求用户介入。

### Algedonic Signal

偏差产生可见信号（而非被静默吸收）。渲染错误、格式校验失败、truth surface 冲突都会产生明确的错误标记，驱动系统自我纠偏。

## 项目结构

```
bonfire/
├── bin/            CLI 工具（bonfire-tools.cjs）
├── skills/         5 个 skill 定义（pre/plan/code/achieve/render）
├── agents/         10 个 subagent 定义
├── references/     共享知识文档（playbook、quality bar 等）
├── schemas/        JSON schema（bonfire-v1.json）
├── templates/      22 个 markdown 渲染模板
├── hooks/          dual-write hook
├── tests/          测试套件
├── examples/       示例数据（golden test case）
├── install.sh      安装脚本
└── uninstall.sh    卸载脚本
```

## 开发

```bash
# 运行测试
node --test tests/*.js

# 当前测试覆盖
# 114 tests, 0 failures
```

## License

MIT
