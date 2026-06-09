#!/usr/bin/env bash
# install.sh — Mirror myOpenCodeWithMEeee files to ~/.config/opencode/
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
SKILLS=(karpathy-guidelines ultrawork git-master openspec-integration)

echo "Installing myOpenCodeWithMEeee → ${TARGET_DIR}"
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
for skill in "${SKILLS[@]}"; do
  mkdir -p "${TARGET_DIR}/skills/${skill}"
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
