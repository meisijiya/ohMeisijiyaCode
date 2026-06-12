#!/usr/bin/env bash
# memory-plugin/install.sh — v2 long-term memory installer
#
# This script:
# 1. Builds memory-plugin.ts → dist/memory-plugin.js (Bun)
# 2. Builds memory.ts → dist/memory.js (Bun)
# 3. Creates symlink: .opencode/plugins/memory-plugin.js → ../../memory-plugin/dist/memory-plugin.js
# 4. Creates data/memory/projects/ directory (git-tracked MEMORY.md lives here)
# 5. Runs SQLite migrations on data/memory.db
# 6. Creates empty MEMORY.md with 4 section headers if missing
# 7. Prompts user to restart opencode
#
# Use uninstall.sh to remove the installed files (preserves MEMORY.md by default).

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIST="${REPO_DIR}/memory-plugin/dist"

echo "Installing v2 long-term memory plugin → ${REPO_DIR}"
echo ""

# Sanity check
if [[ ! -d "${REPO_DIR}/memory-plugin/src" ]]; then
  echo "ERROR: ${REPO_DIR}/memory-plugin/src not found. Run from inside the repo." >&2
  exit 1
fi

# 1. Build with Bun
echo "→ Building memory-plugin..."
mkdir -p "${PLUGIN_DIST}"
bun build "${REPO_DIR}/memory-plugin/src/memory-plugin.ts" \
  --target=bun \
  --outfile "${PLUGIN_DIST}/memory-plugin.js"
bun build "${REPO_DIR}/memory-plugin/src/memory.ts" \
  --target=bun \
  --outfile "${PLUGIN_DIST}/memory.js"
echo "  ✓ Built: dist/memory-plugin.js, dist/memory.js"

# 2. Create symlink
mkdir -p "${REPO_DIR}/.opencode/plugins"
ln -sf "../../memory-plugin/dist/memory-plugin.js" \
  "${REPO_DIR}/.opencode/plugins/memory-plugin.js"
echo "  ✓ Symlink: .opencode/plugins/memory-plugin.js"

# 3. Create data dirs
mkdir -p "${REPO_DIR}/data/memory/projects"

# 4. Run migrations
echo "→ Running SQLite migrations..."
DB_PATH="${REPO_DIR}/data/memory.db"
PROJECT_ID=$(echo -n "${REPO_DIR}" | sha256sum | cut -c1-12)
MEMORY_DIR="${REPO_DIR}/data/memory/projects/${PROJECT_ID}"
mkdir -p "${MEMORY_DIR}"

cat > /tmp/_run_migrate.mjs <<EOF
import { Database } from "bun:sqlite"
import { migrate } from "${REPO_DIR}/memory-plugin/src/lib/migrate.ts"
const db = new Database("${DB_PATH}")
migrate(db)
db.close()
console.log("  ✓ Migrations applied")
EOF
bun /tmp/_run_migrate.mjs
rm -f /tmp/_run_migrate.mjs

# 5. Create MEMORY.md template if not present
if [[ ! -f "${MEMORY_DIR}/MEMORY.md" ]]; then
  cat > "${MEMORY_DIR}/MEMORY.md" <<'TEMPLATE'
# Project Memory

## Project context

## Rules

## Architecture decisions

## Discovered durable knowledge
TEMPLATE
  echo "  ✓ Created MEMORY.md template at ${MEMORY_DIR}/MEMORY.md"
fi

echo ""
echo "✅ memory-plugin v2 installed."
echo ""
echo "Next steps:"
echo "1. Restart opencode to load the plugin"
echo "2. The plugin will auto-inject project memory on session.created"
echo "3. Use '/dream' to force a full reconcile"
echo ""
echo "To uninstall: ./memory-plugin/uninstall.sh"
