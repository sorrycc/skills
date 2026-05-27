#!/usr/bin/env bash
# commit.sh — Validate, stage, commit, push for the /go skill.
# Usage: commit.sh "<message>" <path1> [<path2> ...]
# Emits JSON on stdout:
#   success: {"sha":"...","branch":"...","pushed":true}
#   push failed: {"sha":"...","branch":"...","pushed":false,"pushError":"..."}
# Exit codes:
#   0 — committed and pushed
#   3 — message validation failed (no git mutation)
#   4 — no paths supplied (no git mutation)
#   5 — committed locally but push failed (JSON still emitted with pushed:false)
#   6 — bun run format failed (no git mutation)
#   * — propagated from git stage/commit failure (no JSON emitted)

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "commit.sh: usage: commit.sh \"<message>\" <path1> [<path2> ...]" >&2
  exit 4
fi

MSG="$1"
shift

# Bash 3.2-compatible regex validation. macOS dev box ships bash 3.2;
# escaped space in [[ =~ ]] is required.
if [[ ! "$MSG" =~ ^(feat|fix|docs|chore|refactor|test|perf|style|build|ci)(\(.+\))?:\ .+ ]]; then
  echo "commit.sh: invalid commit message — must match ^(feat|fix|docs|chore|refactor|test|perf|style|build|ci)(\(.+\))?: .+" >&2
  echo "commit.sh: got: $MSG" >&2
  exit 3
fi

if [ "$#" -lt 1 ]; then
  echo "commit.sh: no paths supplied to stage" >&2
  exit 4
fi

# Move to repo root.
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "commit.sh: not inside a git repository" >&2
  exit 64
}
cd "$ROOT"

# Format step — skip if not configured. Real format failures still abort.
if command -v bun >/dev/null 2>&1 \
  && [ -f package.json ] \
  && grep -qE '"format"[[:space:]]*:' package.json; then
  if ! bun run format; then
    echo "commit.sh: format step failed; aborting commit" >&2
    exit 6
  fi
else
  echo "commit.sh: no format step configured; skipping" >&2
fi

# Stage explicit paths. Never -A / . — only what the caller specified.
git add -- "$@"

# Commit via HEREDOC. No --no-verify, no --amend.
git commit -m "$(cat <<EOF
$MSG
EOF
)"

SHA=$(git rev-parse HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Small JSON escape for the pushError stderr capture.
json_escape() {
  python3 -c '
import sys, json
data = sys.stdin.buffer.read()
text = data.decode("utf-8", errors="replace")
print(json.dumps(text)[1:-1], end="")
' 2>/dev/null || sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e ':a;N;$!ba;s/\n/\\n/g'
}

# Push — wrapped so a failure does NOT kill the script before JSON is emitted.
PUSH_ERR_FILE=$(mktemp)
trap 'rm -f "$PUSH_ERR_FILE"' EXIT

set +e
if git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
  git push 2>"$PUSH_ERR_FILE"
  PUSH_RC=$?
else
  git push -u origin HEAD 2>"$PUSH_ERR_FILE"
  PUSH_RC=$?
fi
set -e

if [ "$PUSH_RC" -eq 0 ]; then
  printf '{"sha":"%s","branch":"%s","pushed":true}\n' "$SHA" "$BRANCH"
  exit 0
else
  # Capture first non-empty line of stderr as a single-line pushError.
  ERR_LINE=$(grep -v '^[[:space:]]*$' "$PUSH_ERR_FILE" | head -n1 || true)
  ESC=$(printf '%s' "$ERR_LINE" | json_escape)
  BRANCH_ESC=$(printf '%s' "$BRANCH" | json_escape)
  printf '{"sha":"%s","branch":"%s","pushed":false,"pushError":"%s"}\n' \
    "$SHA" "$BRANCH_ESC" "$ESC"
  exit 5
fi
