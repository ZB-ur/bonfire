#!/bin/bash
set -e

INSTALL_DIR="$HOME/.claude/bonfire"
SETTINGS_FILE="$HOME/.claude/settings.json"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── 前置检查 ──────────────────────────────────────────────────

if ! command -v node &>/dev/null; then
  echo "错误: 未找到 Node.js。请先安装 Node.js 22+ (https://nodejs.org)"
  exit 1
fi

NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "错误: 需要 Node.js 22+，当前版本为 $(node -v)"
  exit 1
fi

# ── 安装文件 ──────────────────────────────────────────────────

echo "安装 bonfire 到 $INSTALL_DIR ..."

# 覆盖安装：清除旧目录
if [ -d "$INSTALL_DIR" ]; then
  echo "检测到已有安装，正在覆盖..."
  rm -rf "$INSTALL_DIR"
fi

mkdir -p "$INSTALL_DIR"

# 复制运行时所需目录
DIRS="bin skills agents references hooks schemas templates .claude-plugin"
for dir in $DIRS; do
  if [ -d "$SCRIPT_DIR/$dir" ]; then
    cp -R "$SCRIPT_DIR/$dir" "$INSTALL_DIR/$dir"
  fi
done

chmod +x "$INSTALL_DIR/bin/bonfire-tools.cjs"

# ── 注册 dual-write hook ─────────────────────────────────────

echo "注册 dual-write hook ..."

mkdir -p "$HOME/.claude"

node -e "
const fs = require('fs');
const settingsPath = '$SETTINGS_FILE';
let settings = {};

try {
  settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
} catch (_) {}

if (!settings.hooks) settings.hooks = {};
if (!Array.isArray(settings.hooks.PostToolUse)) settings.hooks.PostToolUse = [];

const hookCmd = 'node \$HOME/.claude/bonfire/hooks/bonfire-dual-write.js';
const exists = settings.hooks.PostToolUse.some(
  h => h.hooks && h.hooks.some(hh => hh.command && hh.command.includes('bonfire-dual-write'))
);

if (!exists) {
  settings.hooks.PostToolUse.push({
    matcher: 'Write|Edit',
    hooks: [{ type: 'command', command: hookCmd, timeout: 10 }]
  });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  console.log('  hook 已注册');
} else {
  console.log('  hook 已存在，跳过');
}
"

# ── 完成 ──────────────────────────────────────────────────────

echo ""
echo "安装完成！"
echo ""
echo "可用命令:"
echo "  /bonfire:pre     — 初始化案例，运行 Stage A"
echo "  /bonfire:plan    — 运行 Stage B-J 规划 pipeline"
echo "  /bonfire:code    — 执行 frozen handoff 编码"
echo "  /bonfire:achieve — 验收确认"
echo "  /bonfire:render  — 渲染 markdown bundle"
echo ""
echo "在任意项目目录中使用 /bonfire:pre 开始。"
