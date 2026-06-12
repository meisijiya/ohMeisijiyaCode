#!/usr/bin/env bash
# uninstall.sh — Remove ohMeisijiyaCode files from ~/.config/opencode/
#
# Removes only files this project installed, and the matching entry from
# opencode.json's `plugin` array (if it was registered by install.sh).
# Does NOT touch:
# - oh-my-openagent.json or any other plugin config
# - Existing opencode plugins (rtk.ts, etc.)
# - Existing AGENTS.md
# - Existing tools that we did not create (e.g., the user may have their own)
# - Existing MCPs that were added before install.sh (e.g., MiniMax via /connect)
#
# Idempotent: safe to run multiple times.

set -euo pipefail

TARGET_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
OPENCODE_CONFIG="${TARGET_DIR}/opencode.json"
PLUGIN_ENTRY="plugins/orchestrator.js"

echo "Uninstalling ohMeisijiyaCode from ${TARGET_DIR}"
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
rm_target "agents/lyra.md"
rm_target "agents/hephaestus.md"

# Our specific skills
rm_target_dir "skills/caveman"
rm_target_dir "skills/diagnose"
rm_target_dir "skills/git-workflow-and-versioning"
rm_target_dir "skills/grill-with-docs"
rm_target_dir "skills/handoff"
rm_target_dir "skills/incremental-implementation"
rm_target_dir "skills/interview-me"
rm_target_dir "skills/karpathy-guidelines"
rm_target_dir "skills/mmx-cli-usage"
rm_target_dir "skills/openspec-integration"
rm_target_dir "skills/prototype"
rm_target_dir "skills/source-driven-development"
rm_target_dir "skills/tdd"
rm_target_dir "skills/to-issues"
rm_target_dir "skills/zoom-out"

# Our specific tools (only those we created)
rm_target "tools/hashline-edit.js"
rm_target "tools/task-dispatch.js"

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

# Remove compaction block (only if it matches our template — preserve user's custom settings)
if [[ -f "${OPENCODE_CONFIG}" ]]; then
  REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  COMPACTION_TEMPLATE="${REPO_DIR}/templates/opencode-compaction.jsonc"
  if [[ -f "${COMPACTION_TEMPLATE}" ]]; then
    REMOVE_COMPACTION_OUTPUT="$(python3 - "${OPENCODE_CONFIG}" "${COMPACTION_TEMPLATE}" <<'PY_EOF' 2>&1
import json, sys

config_path, template_path = sys.argv[1], sys.argv[2]
try:
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    with open(template_path, "r", encoding="utf-8") as f:
        template = json.load(f)
except (json.JSONDecodeError, OSError) as e:
    print(f"WARN: could not read files: {e}")
    sys.exit(0)

removed = False

# Remove compaction block if it matches our template (deep equal)
user_compaction = config.get("compaction")
if user_compaction == template.get("compaction"):
    del config["compaction"]
    removed = True
    print("removed: compaction block (matched our template)")

# Remove agent.compaction.prompt if it matches our template prompt
ac = config.get("agent", {}).get("compaction")
template_prompt = template.get("agent", {}).get("compaction", {}).get("prompt")
if isinstance(ac, dict) and ac.get("prompt") == template_prompt:
    del ac["prompt"]
    # If agent.compaction is now empty, remove it entirely
    if not ac:
        del config["agent"]["compaction"]
    removed = True
    print("removed: agent.compaction.prompt (matched our template)")

if not removed:
    print("preserved: compaction block (user-customized, not removed)")
else:
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
        f.write("\n")
PY_EOF
)"
    echo "compaction: ${REMOVE_COMPACTION_OUTPUT}"
  fi
fi

echo ""
echo "✓ Uninstall complete. Restart opencode to apply changes."
echo "Note: your providers, MCPs (from /connect), and personal AGENTS.md are preserved."