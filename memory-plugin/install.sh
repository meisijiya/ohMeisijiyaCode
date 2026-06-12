#!/usr/bin/env bash
# memory-plugin/install.sh — v3 long-term memory installer
#
# v3 changes from v2:
# - No I/O at install time (migrations run lazily in hooks)
# - Uses data/memory-plugin.db (not data/memory.db)
# - Portable: works in any directory (global plugin install)
# - Full feature parity: hooks + search + curator agent
#
# Usage: bash memory-plugin/install.sh
# Uninstall: bash memory-plugin/uninstall.sh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_SRC="${REPO_DIR}/memory-plugin/src/memory-plugin.ts"
MEMORY_SRC="${REPO_DIR}/memory-plugin/src/memory.ts"
PLUGIN_DIST="${REPO_DIR}/memory-plugin/dist"
GLOBAL_PLUGINS_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/plugins"
GLOBAL_AGENTS_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/agents"
GLOBAL_COMMANDS_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/commands"

echo "🐘 Installing v3 long-term memory plugin → ${REPO_DIR}"
echo ""

# Sanity check
if [[ ! -f "${PLUGIN_SRC}" ]]; then
  echo "ERROR: ${PLUGIN_SRC} not found. Run from repo root." >&2
  exit 1
fi

# 1. Build with Bun
echo "→ Building memory-plugin..."
mkdir -p "${PLUGIN_DIST}"
bun build "${PLUGIN_SRC}" \
  --target=bun \
  --outfile "${PLUGIN_DIST}/memory-plugin.js" \
  --external "@opencode-ai/plugin"
echo "  ✓ Built: dist/memory-plugin.js"

if [[ -f "${MEMORY_SRC}" ]]; then
  bun build "${MEMORY_SRC}" \
    --target=bun \
    --outfile "${PLUGIN_DIST}/memory.js" \
    --external "@opencode-ai/plugin" 2>/dev/null || true
  echo "  ✓ Built: dist/memory.js"
fi

# 2. Project-local symlink (opencode auto-discovers .opencode/plugins/)
mkdir -p "${REPO_DIR}/.opencode/plugins"
ln -sf "../../memory-plugin/dist/memory-plugin.js" \
  "${REPO_DIR}/.opencode/plugins/memory-plugin.js"
echo "  ✓ Symlink: .opencode/plugins/memory-plugin.js"

# 3. Global symlinks (belt-and-suspenders)
mkdir -p "${GLOBAL_PLUGINS_DIR}"
ln -sf "${PLUGIN_DIST}/memory-plugin.js" \
  "${GLOBAL_PLUGINS_DIR}/memory-plugin.js"
echo "  ✓ Symlink: ${GLOBAL_PLUGINS_DIR}/memory-plugin.js"

# 4. Register curator agent globally
mkdir -p "${GLOBAL_AGENTS_DIR}"
ln -sf "${REPO_DIR}/memory-plugin/agents/memory-curator.md" \
  "${GLOBAL_AGENTS_DIR}/memory-curator.md"
echo "  ✓ Symlink: ${GLOBAL_AGENTS_DIR}/memory-curator.md"

# 5. Register /dream command globally
mkdir -p "${GLOBAL_COMMANDS_DIR}"
ln -sf "${REPO_DIR}/.opencode/commands/dream.md" \
  "${GLOBAL_COMMANDS_DIR}/dream.md"
echo "  ✓ Symlink: ${GLOBAL_COMMANDS_DIR}/dream.md"

echo ""
echo "✅ memory-plugin v3 installed."
echo ""
echo "Verification:"
echo "  1. Restart opencode in this project"
echo "  2. Check for marker: ls data/memory/.hook-session.created-*"
echo "  3. Check logs:   grep 'memory-plugin' ~/.local/share/opencode/log/opencode.log"
echo ""
echo "To uninstall: bash memory-plugin/uninstall.sh"
