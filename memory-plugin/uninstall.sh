#!/usr/bin/env bash
# memory-plugin/uninstall.sh — v3 long-term memory uninstaller
#
# Removes symlinks and built artifacts.
# Preserves data/memory-plugin.db and data/memory/ by default.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GLOBAL_PLUGINS_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/plugins"
GLOBAL_AGENTS_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/agents"
GLOBAL_COMMANDS_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/commands"
GLOBAL_SKILLS_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/skills"

echo "→ Removing symlinks..."
rm -f "${REPO_DIR}/.opencode/plugins/memory-plugin.js"
rm -f "${GLOBAL_PLUGINS_DIR}/memory-plugin.js"
rm -f "${GLOBAL_AGENTS_DIR}/memory-curator.md"
rm -f "${GLOBAL_COMMANDS_DIR}/dream.md"
rm -rf "${GLOBAL_SKILLS_DIR}/memory"
echo "  ✓ Symlinks removed"

echo "→ Cleaning dist..."
rm -rf "${REPO_DIR}/memory-plugin/dist"
echo "  ✓ dist/ removed"

echo ""
echo "✅ memory-plugin v3 uninstalled."
echo ""
echo "Note: data/memory-plugin.db and data/memory/ are preserved."
echo "To clean them: rm -rf data/memory-plugin.db data/memory/"
