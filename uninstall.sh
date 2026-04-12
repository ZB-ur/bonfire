#!/bin/bash
set -e

INSTALL_DIR="$HOME/.claude/bonfire"
SETTINGS_FILE="$HOME/.claude/settings.json"

# ── 移除安装目录 ──────────────────────────────────────────────

if [ -d "$INSTALL_DIR" ]; then
  echo "移除 $INSTALL_DIR ..."
  rm -rf "$INSTALL_DIR"
else
  echo "$INSTALL_DIR 不存在，跳过"
fi

# ── 移除 hook 注册 ───────────────────────────────────────────

if [ -f "$SETTINGS_FILE" ]; then
  echo "清理 hook 注册 ..."
  node -e "
const fs = require('fs');
const settingsPath = '$SETTINGS_FILE';
let settings;

try {
  settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
} catch (_) {
  process.exit(0);
}

if (settings.hooks && Array.isArray(settings.hooks.PostToolUse)) {
  settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(
    h => !(h.hooks && h.hooks.some(hh => hh.command && hh.command.includes('bonfire-dual-write')))
  );
  // 清理空结构
  if (settings.hooks.PostToolUse.length === 0) {
    delete settings.hooks.PostToolUse;
  }
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  console.log('  hook 已移除');
} else {
  console.log('  未找到 hook，跳过');
}
"
fi

echo ""
echo "卸载完成。"
