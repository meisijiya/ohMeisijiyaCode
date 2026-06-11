#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# memory-plugin — opt-in uninstall script
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LINK_TARGET="$PROJECT_ROOT/.opencode/plugins/memory-plugin.js"
MEMORY_FILE="$PROJECT_ROOT/MEMORY.md"

# --- Color helpers ---
green() { printf '\033[32m%s\033[0m\n' "$*"; }
red()   { printf '\033[31m%s\033[0m\n' "$*"; }
blue()  { printf '\033[34m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

blue "🗑️  memory-plugin uninstall — starting"

# Step 1: Remove symlink
blue "  [1/4] Removing plugin symlink..."
if [ -L "$LINK_TARGET" ]; then
  rm "$LINK_TARGET"
  green "  ✅ Removed $LINK_TARGET"
else
  echo "  ℹ️  No symlink found — skipping"
fi

# Step 2: Remove dist/
blue "  [2/4] Compiled output..."
if [ -d "$SCRIPT_DIR/dist" ]; then
  read -r -p "  ❓ Remove dist/ directory? (y/N) " answer
  if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
    rm -rf "$SCRIPT_DIR/dist"
    green "  ✅ dist/ removed"
  else
    echo "  ℹ️  dist/ kept"
  fi
else
  echo "  ℹ️  No dist/ directory — skipping"
fi

# Step 3: MEMORY.md (user data — warn, keep by default)
blue "  [3/4] MEMORY.md (contains all project history)..."
if [ -f "$MEMORY_FILE" ]; then
  echo ""
  yellow "  ⚠️  WARNING: MEMORY.md contains your project's long-term memory."
  yellow "  ⚠️  Deleting it will LOSE all historical decisions, lessons, and constraints."
  read -r -p "  ❓ Delete MEMORY.md? (y/N) " answer
  if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
    rm "$MEMORY_FILE"
    red "  ❌ MEMORY.md deleted"
  else
    green "  ✅ MEMORY.md preserved"
  fi
else
  echo "  ℹ️  No MEMORY.md found — skipping"
fi

# Step 4: Remove entire memory-plugin/ directory
blue "  [4/4] Plugin directory..."
read -r -p "  ❓ Remove entire $SCRIPT_DIR directory? (y/N) " answer
if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
  rm -rf "$SCRIPT_DIR"
  red "  ❌ memory-plugin/ directory deleted"
else
  echo "  ℹ️  memory-plugin/ kept — you can reinstall later"
fi

echo ""
green "✅ memory-plugin uninstall complete."
echo "  ➜ Restart opencode for changes to take effect."
