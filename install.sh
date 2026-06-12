#!/usr/bin/env bash
# install.sh — Mirror ohMeisijiyaCode files to ~/.config/opencode/
#
# This script copies (not symlinks) so that:
# 1. The repo is self-contained
# 2. Modifications to ~/.config/opencode/ don't accidentally pollute the repo
# 3. Re-running the script is idempotent
#
# Use uninstall.sh to remove the installed files.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
SKILLS=(caveman diagnose git-workflow-and-versioning grill-with-docs handoff incremental-implementation interview-me karpathy-guidelines mmx-cli-usage openspec-integration prototype source-driven-development tdd to-issues zoom-out)

echo "Installing ohMeisijiyaCode → ${TARGET_DIR}"
echo ""

# Sanity check
if [[ ! -d "${REPO_DIR}/agents" ]]; then
  echo "ERROR: ${REPO_DIR}/agents not found. This script must be run from inside the cloned repo." >&2
  exit 1
fi

# Create target dirs
mkdir -p "${TARGET_DIR}/agents"
mkdir -p "${TARGET_DIR}/tools"
mkdir -p "${TARGET_DIR}/plugins"
# Only create skill dirs that have a SKILL.md to install (avoid empty dirs)
for skill in "${SKILLS[@]}"; do
  if [[ -f "${REPO_DIR}/skills/${skill}/SKILL.md" ]]; then
    mkdir -p "${TARGET_DIR}/skills/${skill}"
  fi
done

# Helper: copy a single source file to target dir, skipping if source missing
# Usage: copy_file_if_exists <source> <target_dir>
copy_file_if_exists() {
  local src="$1"
  local dst_dir="$2"
  if [[ -f "${src}" ]]; then
    cp -v "${src}" "${dst_dir}/"
  fi
}

# Mirror agents (any .md in agents/)
for src in "${REPO_DIR}/agents/"*.md; do
  [[ -f "${src}" ]] || continue
  cp -v "${src}" "${TARGET_DIR}/agents/"
done

# Mirror skills (SKILL.md from each skill dir)
for skill in "${SKILLS[@]}"; do
  copy_file_if_exists \
    "${REPO_DIR}/skills/${skill}/SKILL.md" \
    "${TARGET_DIR}/skills/${skill}"
done

# Mirror tools (built .js files in tools/dist/, EXCLUDING tests, placeholders, and helper modules)
if [[ -d "${REPO_DIR}/tools/dist" ]]; then
  for src in "${REPO_DIR}/tools/dist/"*.js; do
    [[ -f "${src}" ]] || continue
    # Skip test files, placeholders, and internal helper modules (bundled into their consumer)
    case "$(basename "${src}")" in
      *.test.js|*.spec.js|placeholder.js|hashline-tag.js) continue ;;
    esac
    cp -v "${src}" "${TARGET_DIR}/tools/"
  done
fi

# Mirror plugin (built output lives under .opencode/plugins/)
copy_file_if_exists \
  "${REPO_DIR}/.opencode/plugins/orchestrator.js" \
  "${TARGET_DIR}/plugins"

# Set up global AGENTS.md (personal preferences) — only if user doesn't have one
# We do NOT overwrite — protect existing personal config.
# The template has placeholders like {{SYSTEM_INFO}} that the user fills in.
GLOBAL_AGENTS="${TARGET_DIR}/AGENTS.md"
TEMPLATE_AGENTS="${REPO_DIR}/templates/AGENTS.md"
if [[ -f "${TEMPLATE_AGENTS}" ]]; then
  if [[ -f "${GLOBAL_AGENTS}" ]]; then
    echo "AGENTS.md: already exists at ${GLOBAL_AGENTS} (skipped — not overwriting personal config)"
  else
    cp -v "${TEMPLATE_AGENTS}" "${GLOBAL_AGENTS}"
    echo "AGENTS.md: installed template → ${GLOBAL_AGENTS}"
    echo "  ⚠️  IMPORTANT: Edit the file and replace the {{...}} placeholders with your own values!"
    echo "  - {{SYSTEM_INFO}}           → your OS (e.g., WSL2 Ubuntu 24.04, macOS Sonoma)"
    echo "  - {{CODING_STYLE_NOTE}}     → your preferred code commenting style"
    echo "  - {{EMOJI_USAGE_NOTE}}      → your emoji usage preference"
  fi
fi

# Auto-register the plugin in opencode.json (if it exists and isn't already there)
# This is the equivalent of `/connect` for plugins — it reuses whatever the user
# already has in their opencode.json rather than re-declaring providers/MCPs.
OPENCODE_CONFIG="${TARGET_DIR}/opencode.json"
PLUGIN_ENTRY="plugins/orchestrator.js"

if [[ -f "${OPENCODE_CONFIG}" ]]; then
  # Use python3 (universally available) for safe JSON manipulation
  REGISTER_OUTPUT="$(python3 - "${OPENCODE_CONFIG}" "${PLUGIN_ENTRY}" <<'PY_EOF' 2>&1
import json, sys, os

config_path, plugin_entry = sys.argv[1], sys.argv[2]
with open(config_path, "r", encoding="utf-8") as f:
    config = json.load(f)

plugins = config.get("plugin", [])
if not isinstance(plugins, list):
    print(f"WARN: existing 'plugin' field is not a list ({type(plugins).__name__}); skipping auto-registration")
    sys.exit(0)

# Don't double-register
if plugin_entry in plugins:
    print(f"already-registered: {plugin_entry}")
    sys.exit(0)

plugins.append(plugin_entry)
config["plugin"] = plugins

# Preserve formatting (2-space indent, trailing newline, sorted keys not required)
with open(config_path, "w", encoding="utf-8") as f:
    json.dump(config, f, indent=2, ensure_ascii=False)
    f.write("\n")
print(f"registered: {plugin_entry}")
PY_EOF
)"
  echo "opencode.json: ${REGISTER_OUTPUT}"
else
  echo "opencode.json: not found at ${OPENCODE_CONFIG} — skipping auto-registration"
  echo "  To enable the plugin manually, add 'plugins/orchestrator.js' to:"
  echo "    ${OPENCODE_CONFIG}"
fi


# Apply compaction strategy (340K trigger) — only if user doesn't have a 'compaction' block
# This is a non-destructive merge: if the user has any custom compaction settings,
# we keep them. If not, we apply our optimized 340K-trigger defaults.
COMPACTION_TEMPLATE="${REPO_DIR}/templates/opencode-compaction.jsonc"
if [[ -f "${OPENCODE_CONFIG}" ]] && [[ -f "${COMPACTION_TEMPLATE}" ]]; then
  COMPACTION_OUTPUT="$(python3 - "${OPENCODE_CONFIG}" "${COMPACTION_TEMPLATE}" <<'PY_EOF' 2>&1
import json, sys

config_path, template_path = sys.argv[1], sys.argv[2]
with open(config_path, "r", encoding="utf-8") as f:
    config = json.load(f)
with open(template_path, "r", encoding="utf-8") as f:
    template = json.load(f)

# Skip if user already has a 'compaction' block — respect their settings
if "compaction" in config:
    print("already-configured: compaction (skipped — using existing settings)")
    sys.exit(0)

# Apply compaction block
config["compaction"] = template["compaction"]

# Apply agent.compaction prompt (only if user doesn't have one)
agents = config.setdefault("agent", {})
ac = agents.get("compaction")
if not (isinstance(ac, dict) and "prompt" in ac):
    # Merge: keep any existing agent.compaction fields, add prompt
    if not isinstance(ac, dict):
        ac = {}
    ac["prompt"] = template["agent"]["compaction"]["prompt"]
    agents["compaction"] = ac
    print("merged: agent.compaction.prompt added")

# Preserve formatting
with open(config_path, "w", encoding="utf-8") as f:
    json.dump(config, f, indent=2, ensure_ascii=False)
    f.write("\n")
print("applied: compaction block (340K trigger strategy)")
PY_EOF
)"
  echo "compaction: ${COMPACTION_OUTPUT}"
else
  if [[ ! -f "${OPENCODE_CONFIG}" ]]; then
    echo "compaction: skipped (no opencode.json yet)"
  fi
fi


# Check CLI availability (recommended, not required)
echo ""
echo "🔧 推荐的 CLI 工具（按需安装）："
check_cli() {
  local cmd="$1" desc="$2" install_cmd="$3"
  if command -v "$cmd" &>/dev/null; then
    echo "  ✅ ${cmd} — ${desc}"
  else
    echo "  ⬜ ${cmd} — ${desc}（${install_cmd}）"
  fi
}
check_cli "mmx"         "MiniMax 多模态 CLI（搜索/图像/视频/语音）" "npm i -g mmx-cli && mmx auth login"
check_cli "ctx7"         "库文档查询 CLI"                           "npm i -g ctx7 && npx ctx7 setup --opencode"
check_cli "playwright-cli" "浏览器自动化 CLI"                       "npm i -g @playwright/cli@latest && playwright-cli install --skills"

echo ""
echo "✓ Install complete. Restart opencode to pick up changes."
echo ""
echo "Installed locations:"

# Listing helpers (tolerate empty dirs under set -e)
list_dir() {
  local d="$1"
  if [[ -d "${d}" ]] && [[ -n "$(ls -A "${d}" 2>/dev/null)" ]]; then
    ls -1 "${d}" | sed 's/^/    /'
  else
    echo "    (empty)"
  fi
}

echo "  Agents:"
list_dir "${TARGET_DIR}/agents" | sed 's/^/  /'
echo "  Skills:"
for skill in "${SKILLS[@]}"; do
  if [[ -d "${TARGET_DIR}/skills/${skill}" ]] && [[ -n "$(ls -A "${TARGET_DIR}/skills/${skill}" 2>/dev/null)" ]]; then
    echo "    ${skill}/"
    ls -1 "${TARGET_DIR}/skills/${skill}" | sed 's/^/      /'
  fi
done
echo "  Tools:"
# Use a glob that lists production .js files (exclude .test.js, .spec.js, placeholders, helpers)
shopt -s nullglob
prod_tools=("${TARGET_DIR}/tools/"*.js)
shopt -u nullglob
# Filter out test/spec files, placeholders, and internal helpers
filtered_tools=()
for f in "${prod_tools[@]}"; do
  case "$(basename "${f}")" in
    *.test.js|*.spec.js|placeholder.js|hashline-tag.js) continue ;;
  esac
  filtered_tools+=("${f}")
done
if [[ ${#filtered_tools[@]} -gt 0 ]]; then
  for f in "${filtered_tools[@]}"; do
    echo "    $(basename "${f}")"
  done
else
  echo "    (none built yet)"
fi
echo "  Plugins:"
list_dir "${TARGET_DIR}/plugins" | sed 's/^/  /'
echo "  AGENTS.md (global):"
if [[ -f "${GLOBAL_AGENTS}" ]]; then
  echo "    $(basename "${GLOBAL_AGENTS}")  ← $(wc -l < "${GLOBAL_AGENTS}" | tr -d ' ') lines"
fi
