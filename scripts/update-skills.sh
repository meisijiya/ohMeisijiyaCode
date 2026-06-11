#!/usr/bin/env bash
# scripts/update-skills.sh — Check for upstream drift in our 15 global skills
#
# Usage:
#   bash scripts/update-skills.sh                # Check only (default)
#   bash scripts/update-skills.sh --apply        # Apply updates (verbatim only)
#   bash scripts/update-skills.sh --dry-run      # Show what would change, don't write
#   bash scripts/update-skills.sh --skill NAME   # Check specific skill
#
# Exit codes:
#   0  = all skills up-to-date (or all updates applied successfully)
#   1  = drift detected (check mode) or apply failed
#   2  = network/auth error
#
# How it works:
#   1. Parses skills/SOURCES.yaml (Python 3 yaml or simple parser)
#   2. For each verbatim/reimpl skill with a source_repo, fetches latest from
#      https://api.github.com/repos/<repo>/contents/<path>
#   3. Computes SHA-256 of local + upstream content
#   4. If they differ, reports drift
#   5. With --apply, writes the upstream content to skills/<name>/SKILL.md
#      (verbatim only — reimpl skills are NEVER auto-updated)

set -euo pipefail

# ===== Config =====
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCES_FILE="${REPO_DIR}/skills/SOURCES.yaml"
SKILLS_DIR="${REPO_DIR}/skills"
PYTHON="${PYTHON:-python3}"

# ===== Flags =====
MODE="check"            # check | apply | dry-run
FILTER_SKILL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)    MODE="apply"; shift ;;
    --dry-run)  MODE="dry-run"; shift ;;
    --check)    MODE="check"; shift ;;
    --skill)    FILTER_SKILL="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,18p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'
      exit 0
      ;;
    *)          echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
done

# ===== Pre-checks =====
if [[ ! -f "${SOURCES_FILE}" ]]; then
  echo "❌ SOURCES.yaml not found: ${SOURCES_FILE}" >&2
  exit 2
fi

if ! command -v "${PYTHON}" &>/dev/null; then
  echo "❌ python3 required (for YAML + JSON parsing)" >&2
  exit 2
fi

# ===== Single Python script that does the heavy lifting =====
# Reads SOURCES.yaml, fetches each upstream, compares hash, optionally applies.
"${PYTHON}" - "${MODE}" "${FILTER_SKILL}" "${REPO_DIR}" "${SOURCES_FILE}" "${SKILLS_DIR}" <<'PY_EOF'
import sys, os, re, json, hashlib, subprocess, urllib.request, urllib.error

mode = sys.argv[1]
filter_skill = sys.argv[2]
repo_dir = sys.argv[3]
sources_file = sys.argv[4]
skills_dir = sys.argv[5]

# ===== Tiny YAML parser (we control the format) =====
# Avoids requiring PyYAML. Parses our specific SOURCES.yaml shape.
def parse_sources(path):
    """Parse SOURCES.yaml into list of dicts."""
    skills = []
    current = None
    in_subfiles = False
    subfiles_indent = 0
    with open(path) as f:
        lines = f.readlines()
    for line in lines:
        stripped = line.rstrip('\n')
        # Skip comments and blank
        if not stripped.strip() or stripped.strip().startswith('#'):
            continue
        # Top-level skill entry
        m = re.match(r'^  - name:\s*(\S+)\s*$', stripped)
        if m:
            current = {'name': m.group(1), '_subfiles': []}
            skills.append(current)
            in_subfiles = False
            continue
        # Skill field (2-space indent + name: value)
        m = re.match(r'^\s{4}([a-z_]+):\s*(.*)$', stripped)
        if m and current is not None and not in_subfiles:
            key, val = m.group(1), m.group(2).strip()
            if val.startswith('"') and val.endswith('"'):
                val = val[1:-1]
            elif val.startswith("'") and val.endswith("'"):
                val = val[1:-1]
            current[key] = val
            continue
        # Sub-files list (matters for tdd)
        if current is not None and stripped.strip() == 'sub_files:':
            in_subfiles = True
            subfiles_indent = len(stripped) - len(stripped.lstrip())
            continue
        if in_subfiles and current is not None:
            m = re.match(r'^\s+-\s*(\S+)\s*$', stripped)
            if m:
                current['_subfiles'].append(m.group(1))
            elif not stripped.strip().startswith('-'):
                in_subfiles = False
    # Clean up internal field
    for s in skills:
        s.pop('_subfiles', None)
        if 'sub_files' in s and not s['sub_files']:
            s.pop('sub_files', None)
    return skills

skills = parse_sources(sources_file)

# Filter if requested
if filter_skill:
    skills = [s for s in skills if s['name'] == filter_skill]
    if not skills:
        print(f"❌ Skill '{filter_skill}' not found in SOURCES.yaml", file=sys.stderr)
        sys.exit(1)

# ===== Fetch + compare =====
def fetch_upstream(skill):
    """Fetch latest SKILL.md from GitHub. Returns (content, sha, etag) or None on error."""
    if 'source_repo' not in skill or 'source_path' not in skill:
        return None
    repo = skill['source_repo']
    path = skill['source_path']
    url = f"https://api.github.com/repos/{repo}/contents/{path}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'myOpenCodeWithMEeee-updater'})
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f"  ⚠️  upstream not found: {url}", file=sys.stderr)
            return None
        raise
    except urllib.error.URLError as e:
        print(f"  ⚠️  network error: {e}", file=sys.stderr)
        return None
    import base64
    content = base64.b64decode(data['content']).decode('utf-8')
    return {
        'content': content,
        'sha': data['sha'],
        'url': data['html_url'],
    }

def local_path(skill_name):
    return os.path.join(skills_dir, skill_name, 'SKILL.md')

def read_local(path):
    if not os.path.isfile(path):
        return None
    with open(path, 'rb') as f:
        return f.read()

def hash_bytes(b):
    return hashlib.sha256(b).hexdigest()[:12]  # short hash for display

# ===== Header =====
print(f"🔍 Mode: {mode}")
if filter_skill:
    print(f"📌 Filter: {filter_skill}")
print(f"📂 Repo: {repo_dir}")
print()

# ===== Process each skill =====
stats = {'self': 0, 'verbatim_uptodate': 0, 'verbatim_drift': 0, 'reimpl_skipped': 0, 'errors': 0}

for skill in skills:
    name = skill['name']
    typ = skill.get('type', 'unknown')

    # Self-built: skip
    if typ == 'self':
        print(f"  ⏭️  {name:<32} type=self (no upstream)")
        stats['self'] += 1
        continue

    # Re-implementation: never auto-update
    if typ == 'reimpl':
        print(f"  ⛔ {name:<32} type=reimpl (manual review required, skipped)")
        stats['reimpl_skipped'] += 1
        continue

    # Verbatim: check upstream
    if typ != 'verbatim':
        print(f"  ❓ {name:<32} type={typ} (unknown, skipped)")
        stats['errors'] += 1
        continue

    upstream = fetch_upstream(skill)
    if upstream is None:
        print(f"  ❌ {name:<32} fetch failed")
        stats['errors'] += 1
        continue

    local_bytes = read_local(local_path(name))
    if local_bytes is None:
        print(f"  ⚠️  {name:<32} local file missing (will create on --apply)")
        drift = True
    else:
        local_hash = hash_bytes(local_bytes)
        upstream_hash = hash_bytes(upstream['content'].encode('utf-8'))
        drift = (local_hash != upstream_hash)

    if not drift:
        print(f"  ✅ {name:<32} up-to-date ({hash_bytes(local_bytes)})")
        stats['verbatim_uptodate'] += 1
        continue

    # Drift detected
    stats['verbatim_drift'] += 1
    print(f"  🔄 {name:<32} DRIFT detected")
    print(f"      local:    {hash_bytes(local_bytes) if local_bytes else 'MISSING'}")
    print(f"      upstream: {hash_bytes(upstream['content'].encode('utf-8'))} ({upstream['url']})")

    if mode == 'apply':
        target = local_path(name)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, 'w', encoding='utf-8') as f:
            f.write(upstream['content'])
        # Also handle sub_files for skills like tdd
        if 'sub_files' in skill and skill['sub_files']:
            # Re-fetch the dir to find sub-files
            dir_url = f"https://api.github.com/repos/{skill['source_repo']}/contents/{os.path.dirname(skill['source_path'])}"
            try:
                req = urllib.request.Request(dir_url, headers={'User-Agent': 'myOpenCodeWithMEeee-updater'})
                with urllib.request.urlopen(req, timeout=20) as resp:
                    dir_data = json.loads(resp.read())
                import base64
                for item in dir_data:
                    if item['type'] == 'file' and item['name'] in skill['sub_files']:
                        sub_url = f"https://api.github.com/repos/{skill['source_repo']}/contents/{item['path']}"
                        req2 = urllib.request.Request(sub_url, headers={'User-Agent': 'myOpenCodeWithMEeee-updater'})
                        with urllib.request.urlopen(req2, timeout=20) as resp2:
                            sub_data = json.loads(resp2.read())
                        sub_content = base64.b64decode(sub_data['content']).decode('utf-8')
                        sub_target = os.path.join(os.path.dirname(target), item['name'])
                        with open(sub_target, 'w', encoding='utf-8') as f:
                            f.write(sub_content)
                        print(f"      ↳ {item['name']} updated")
            except Exception as e:
                print(f"      ⚠️  sub-file update failed: {e}", file=sys.stderr)
        print(f"      ✅ {name} applied (verbatim)")
    elif mode == 'dry-run':
        print(f"      🧪 would apply (dry-run)")

# ===== Summary =====
print()
print("=" * 50)
print(f"📊 Summary")
print(f"   self:                {stats['self']}")
print(f"   reimpl (skipped):    {stats['reimpl_skipped']}")
print(f"   verbatim up-to-date: {stats['verbatim_uptodate']}")
print(f"   verbatim DRIFT:      {stats['verbatim_drift']}")
print(f"   errors:              {stats['errors']}")
print("=" * 50)

# Exit codes
if mode == 'check' and stats['verbatim_drift'] > 0:
    print()
    print(f"💡 {stats['verbatim_drift']} skill(s) have upstream drift.")
    print(f"   To update: bash scripts/update-skills.sh --apply")
    print(f"   To preview: bash scripts/update-skills.sh --dry-run")
    sys.exit(1)

if stats['errors'] > 0:
    sys.exit(2)

sys.exit(0)
PY_EOF
