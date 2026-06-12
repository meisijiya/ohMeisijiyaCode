#!/usr/bin/env bash
# memory-plugin/uninstall.sh — Remove v2 long-term memory plugin
#
# By default, preserves:
# - data/memory/projects/<id>/MEMORY.md  (user data, never deleted)
#
# Pass --purge to delete data/memory/ entirely.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PURGE=false
if [[ "${1:-}" == "--purge" ]]; then
  PURGE=true
fi

echo "Uninstalling v2 long-term memory plugin from ${REPO_DIR}"
echo ""

# 1. Remove symlink
if [[ -L "${REPO_DIR}/.opencode/plugins/memory-plugin.js" ]]; then
  rm "${REPO_DIR}/.opencode/plugins/memory-plugin.js"
  echo "  ✓ Removed symlink"
fi

# 2. Remove dist
if [[ -d "${REPO_DIR}/memory-plugin/dist" ]]; then
  rm -rf "${REPO_DIR}/memory-plugin/dist"
  echo "  ✓ Removed dist/"
fi

# 3. MEMORY.md: ask
if [[ -d "${REPO_DIR}/data/memory/projects" ]]; then
  if [[ "${PURGE}" == "true" ]]; then
    rm -rf "${REPO_DIR}/data/memory"
    echo "  ✓ Removed data/memory/ (--purge)"
  else
    echo ""
    echo "  ⚠️  data/memory/projects/<id>/MEMORY.md preserved (user data)."
    echo "      Pass --purge to delete."
  fi
fi

# 4. data/memory.db
if [[ -f "${REPO_DIR}/data/memory.db" ]]; then
  rm -f "${REPO_DIR}/data/memory.db" "${REPO_DIR}/data/memory.db-wal" "${REPO_DIR}/data/memory.db-shm" 2>/dev/null || true
  echo "  ✓ Removed data/memory.db (regenerated on next install)"
fi

echo ""
echo "✅ memory-plugin v2 uninstalled."
echo "Restart opencode to unload the plugin."
