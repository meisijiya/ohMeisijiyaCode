#!/usr/bin/env bash
# uninstall.sh — Remove myOpenCodeWithMEeee files from ~/.config/opencode/
#
# Removes only files this project installed, and the matching entry from
# opencode.json's `plugin` array (if it was registered by install.sh).
# Does NOT touch:
# - oh-my-openagent.json or any other plugin config
# - Existing opencode plugins (rtk.ts, etc.)
# - Existing AGENTS.md
# - Existing tools that we did not create (e.g., the user may have their own)
# - Any providers / MCPs the user added via /connect
#
# Idempotent: safe to run multiple times.

set -euo pipefail

TARGET_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
OPENCODE_CONFIG="${TARGET_DIR}/opencode.json"
PLUGIN_ENTRY="plugins/orchestrator.js"

echo "Uninstalling myOpenCodeWithMEeee from ${TARGET_DIR}"
echo ""

# Helper: rm -f a file under TARGET_DIR, tolerating missing files
rm_target() {
  local f="${TARGET_DIR}/$1"
  if [[ -f "${f}" ]] || [[ -L "${f}" ]]; then
    rm -v "${f}"
  fi
}

# Helper: rm -rf a dir under TARGET_DIR, tolerating missing dirs
rm_target_dir() {
  local d="${TARGET_DIR}/$1"
  if [[ -d "${d}" ]]; then
    rm -rfv "${d}"
  fi
}

# Our specific agents
rm_target "agents/sisyphus.md"
rm_target "agents/oracle.md"

# Our specific skills
rm_target_dir "skills/karpathy-guidelines"
rm_target_dir "skills/ultrawork"
rm_target_dir "skills/git-master"
rm_target_dir "skills/openspec-integration"

# Our specific tools (only those we created)
rm_target "tools/hashline-edit.js"
rm_target "tools/task-dispatch.js"
rm_target "tools/ast-search.js"
rm_target "tools/web-search.js"
rm_target "tools/image-inspect.js"
rm_target "tools/mermaid-render.js"
rm_target "tools/pr-reader.js"
rm_target "tools/atomic-commit.js"
rm_target "tools/context7-docs.js"
rm_target "tools/playwright-browser.js"

# Our specific plugin file
rm_target "plugins/orchestrator.js"

# Unregister plugin from opencode.json (if present)
if [[ -f "${OPENCODE_CONFIG}" ]]; then
  DEREGISTER_OUTPUT="$(python3 - "${OPENCODE_CONFIG}" "${PLUGIN_ENTRY}" <<'PY_EOF' 2>&1
import json, sys

config_path, plugin_entry = sys.argv[1], sys.argv[2]
try:
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
except (json.JSONDecodeError, OSError) as e:
    print(f"WARN: could not read {config_path}: {e}")
    sys.exit(0)

plugins = config.get("plugin", [])
if not isinstance(plugins, list):
    print(f"WARN: 'plugin' field is not a list; skipping")
    sys.exit(0)

if plugin_entry not in plugins:
    print(f"not-registered: {plugin_entry} (not in opencode.json)")
    sys.exit(0)

plugins = [p for p in plugins if p != plugin_entry]
config["plugin"] = plugins

with open(config_path, "w", encoding="utf-8") as f:
    json.dump(config, f, indent=2, ensure_ascii=False)
    f.write("\n")
print(f"unregistered: {plugin_entry}")
PY_EOF
)"
  echo "opencode.json: ${DEREGISTER_OUTPUT}"
else
  echo "opencode.json: not found (nothing to unregister)"
fi

echo ""
echo "✓ Uninstall complete. Restart opencode to apply changes."
echo "Note: providers/MCPs you added via /connect are preserved."
