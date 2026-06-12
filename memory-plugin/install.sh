#!/usr/bin/env bash
# memory-plugin/install.sh — v3 long-term memory installer
#
# v3 changes from v2:
# - No I/O at install time (migrations run lazily in hooks)
# - Uses data/memory-plugin.db (not data/memory.db)
# - Minimal plugin: session.created + session.idle hooks only
#
# Usage: bash memory-plugin/install.sh
# Uninstall: bash memory-plugin/uninstall.sh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_SRC="${REPO_DIR}/memory-plugin/src/memory-plugin.ts"
PLUGIN_DIST="${REPO_DIR}/memory-plugin/dist"
GLOBAL_PLUGINS_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/plugins"

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

# 2. Project-local symlink (opencode auto-discovers .opencode/plugins/)
mkdir -p "${REPO_DIR}/.opencode/plugins"
ln -sf "../../memory-plugin/dist/memory-plugin.js" \
  "${REPO_DIR}/.opencode/plugins/memory-plugin.js"
echo "  ✓ Symlink: .opencode/plugins/memory-plugin.js"

# 3. Global symlink (belt-and-suspenders)
mkdir -p "${GLOBAL_PLUGINS_DIR}"
ln -sf "${PLUGIN_DIST}/memory-plugin.js" \
  "${GLOBAL_PLUGINS_DIR}/memory-plugin.js"
echo "  ✓ Symlink: ${GLOBAL_PLUGINS_DIR}/memory-plugin.js"

echo ""
echo "✅ memory-plugin v3 installed."
echo ""
echo "Verification:"
echo "  1. Restart opencode in this project"
echo "  2. Check for marker: ls data/memory/.hook-session.created-*"
echo "  3. Check logs:   grep 'memory-plugin' ~/.local/share/opencode/log/opencode.log"
echo ""
echo "To uninstall: bash memory-plugin/uninstall.sh"
