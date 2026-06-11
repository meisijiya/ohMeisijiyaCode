#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# memory-plugin — opt-in install script
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_DIR="$PROJECT_ROOT/.opencode/plugins"
DIST_FILE="$SCRIPT_DIR/dist/memory-plugin.js"
LINK_TARGET="$PLUGIN_DIR/memory-plugin.js"

# --- Color helpers ---
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
red()    { printf '\033[31m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
blue()   { printf '\033[34m%s\033[0m\n' "$*"; }

# --- Cleanup trap: on failure, remove partial symlink ---
cleanup() {
  local exit_code=$?
  if [ "$exit_code" -ne 0 ] && [ -L "$LINK_TARGET" ] && [ ! -f "$DIST_FILE" ]; then
    rm -f "$LINK_TARGET" 2>/dev/null || true
    red "  ❌ Cleanup: removed partial symlink (build did not produce dist/)"
  fi
  exit "$exit_code"
}
trap cleanup EXIT

blue "🔧 memory-plugin install — starting"
echo "  Project root : $PROJECT_ROOT"

# Step 1: Compile
blue "  [1/3] Building dist/memory-plugin.js..."
(cd "$SCRIPT_DIR" && bun build src/memory-plugin.ts --target=bun --outfile dist/memory-plugin.js 2>&1)
if [ ! -f "$DIST_FILE" ]; then
  red "  ❌ Build failed — dist/memory-plugin.js not found"
  exit 1
fi
green "  ✅ Build OK ($(wc -c < "$DIST_FILE") bytes)"

# Step 2: Create symlink
blue "  [2/3] Installing symlink to .opencode/plugins/..."
rm -f "$LINK_TARGET"
ln -sf "../../memory-plugin/dist/memory-plugin.js" "$LINK_TARGET"
if [ ! -L "$LINK_TARGET" ]; then
  red "  ❌ Symlink creation failed"
  exit 1
fi
green "  ✅ Symlink: $LINK_TARGET -> ../../memory-plugin/dist/memory-plugin.js"

# Step 3: Check MEMORY.md
blue "  [3/3] Checking MEMORY.md..."
if [ ! -f "$PROJECT_ROOT/MEMORY.md" ]; then
  echo "  ⚠️  MEMORY.md not found at project root."
  echo "  → Create it manually:"
  echo "    cat > \"$PROJECT_ROOT/MEMORY.md\" << 'EOF'"
  echo "    # 项目长期记忆"
  echo "    "
  echo "    > 由 memory-plugin 自动管理。存储项目级决策、教训和约束。"
  echo "    EOF"
else
  green "  ✅ MEMORY.md exists ($(wc -l < "$PROJECT_ROOT/MEMORY.md") lines)"
fi

echo ""
green "🎉 memory-plugin installed successfully!"
echo ""
echo "  ➜ Restart opencode to activate the plugin."
echo "  ➜ See $(dirname "$SCRIPT_DIR")/README.md for usage and configuration."
