#!/usr/bin/env bash
# inspect.sh — Read-only git inspection + secret scan for the /go skill.
# Emits one JSON blob on stdout. Exit codes:
#   0 — something to commit/push and no secrets
#   1 — clean tree (porcelain empty AND no commits ahead of upstream)
#   2 — secret pattern matched in staged or unstaged content
# Human-readable errors go to stderr.

set -euo pipefail

# Move to repo root so all git calls are unambiguous regardless of cwd.
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "inspect.sh: not inside a git repository" >&2
  exit 64
}
cd "$ROOT"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

STATUS="$TMP/status"
DIFF="$TMP/diff"
LOG_AHEAD="$TMP/log_ahead"

# Parallel read-only git calls. NUL-delimited porcelain v2 preserves raw bytes
# in filenames (newline, quote, backslash all legal on darwin/linux).
# `diff HEAD` (worktree vs HEAD) is the single source of truth — equivalent to
# "what would land if everything were committed" — so worktree edits take
# effect without re-staging.
git status --porcelain=v2 -z >"$STATUS" 2>/dev/null &
PID_STATUS=$!
git diff HEAD >"$DIFF" 2>/dev/null &
PID_DIFF=$!
# Guarded: if no upstream, log call would fail under set -e.
if git rev-parse @{u} >/dev/null 2>&1; then
  git log @{u}..HEAD --oneline >"$LOG_AHEAD" 2>/dev/null &
  PID_LOG=$!
else
  : >"$LOG_AHEAD"
  PID_LOG=""
fi

wait "$PID_STATUS" "$PID_DIFF"
if [ -n "$PID_LOG" ]; then wait "$PID_LOG"; fi

# ahead count, guarded against missing upstream.
AHEAD=0
if git rev-parse @{u} >/dev/null 2>&1; then
  AHEAD=$(git rev-list --count @{u}..HEAD 2>/dev/null || echo 0)
fi

# Parse porcelain v2 -z into file list.
# Format reference (v2):
#   "1 XY sub mH mI mW hH hI path\0"            — ordinary changed
#   "2 XY sub mH mI mW hH hI X<score> path\0orig_path\0" — renamed/copied
#   "u XY sub m1 m2 m3 mW h1 h2 h3 path\0"      — unmerged
#   "? path\0"                                  — untracked
#   "! path\0"                                  — ignored (we don't scan ignored)
# We collect the *current* path (not orig_path) for types 1, 2, u, ?.
FILES_RAW="$TMP/files_raw"
: >"$FILES_RAW"

# Read NUL-delimited records.
while IFS= read -r -d '' record; do
  # First char identifies record type.
  case "$record" in
    '1 '*|'u '*)
      # path is the 9th whitespace-separated field for type 1, 11th for u.
      # Simpler: strip the prefix tokens, keep the last "path" portion.
      # Use awk on the record up to the first 8 (type 1) or 10 (type u) fields.
      first_char="${record:0:1}"
      if [ "$first_char" = "1" ]; then
        nfields=9
      else
        nfields=11
      fi
      # Print fields nfields..NF joined by space (filenames can't have NUL but can have spaces).
      path=$(printf '%s' "$record" | awk -v n="$nfields" '{out=$n; for (i=n+1;i<=NF;i++) out=out" "$i; print out}')
      printf '%s\0' "$path" >>"$FILES_RAW"
      ;;
    '2 '*)
      # Rename/copy: path is field 10, then NUL, then orig_path (separately delimited).
      # We grab the current path (field 10..NF on the first NUL-record), then read
      # an additional NUL-delimited record for orig_path which we discard.
      path=$(printf '%s' "$record" | awk '{out=$10; for (i=11;i<=NF;i++) out=out" "$i; print out}')
      printf '%s\0' "$path" >>"$FILES_RAW"
      # Consume orig_path.
      IFS= read -r -d '' _orig || true
      ;;
    '? '*)
      path="${record#? }"
      printf '%s\0' "$path" >>"$FILES_RAW"
      ;;
    '! '*)
      : # ignored; skip
      ;;
    '#'*)
      : # branch header line, ignored
      ;;
  esac
done <"$STATUS"

# Dedupe + sort the file list (NUL-delimited).
FILES_SORTED="$TMP/files_sorted"
if [ -s "$FILES_RAW" ]; then
  # sort -z and uniq -z to handle embedded specials.
  sort -z -u "$FILES_RAW" >"$FILES_SORTED"
else
  : >"$FILES_SORTED"
fi

# Count files.
FILE_COUNT=0
if [ -s "$FILES_SORTED" ]; then
  # Count NUL terminators.
  FILE_COUNT=$(tr -cd '\0' <"$FILES_SORTED" | wc -c | tr -d ' ')
fi

# diffStatBytes — actual byte size of the full worktree-vs-HEAD diff.
DIFF_STAT_BYTES=$(wc -c <"$DIFF" | tr -d ' ')

# Clean = porcelain empty AND ahead == 0.
CLEAN="false"
if [ "$FILE_COUNT" -eq 0 ] && [ "$AHEAD" -eq 0 ]; then
  CLEAN="true"
fi

# ---- Secret scan ----
# Two layers:
#   1. Filename scan — basename `.env` anywhere in the changeset (always runs).
#   2. Content scan — six regexes against added lines (`^+` but not `^+++`),
#      per-file so each hit is attributed `path:pattern-id`. Skipped for
#      documentation files (`.md`/`.mdx`/`.txt`/`.rst`) — false-positive
#      floor was too high (design docs and READMEs legitimately quote
#      example keys); filename `.env` scan still applies everywhere.
SECRETS="$TMP/secrets"
: >"$SECRETS"

# Content patterns: "pattern-id|regex" lines. Order doesn't matter.
PATTERNS_FILE="$TMP/patterns"
cat >"$PATTERNS_FILE" <<'EOF'
API_KEY-assignment|API_KEY[[:space:]]*=[[:space:]]*['"`][^'"`]{16,}['"`]
anthropic-or-openai-key|sk-[A-Za-z0-9]{20,}
private-key-pem|-----BEGIN [A-Z ]+PRIVATE KEY-----
aws-access-key-id|AKIA[0-9A-Z]{16}
github-pat-classic|ghp_[A-Za-z0-9]{36}
github-pat-fine-grained|github_pat_[A-Za-z0-9_]{20,}
EOF

# Skip content scans for these doc extensions (lowercased basename suffix match).
is_doc_path() {
  case "$1" in
    *.md|*.MD|*.mdx|*.MDX|*.txt|*.TXT|*.rst|*.RST) return 0 ;;
    *) return 1 ;;
  esac
}

if [ -s "$FILES_SORTED" ]; then
  ADDED_PER_FILE="$TMP/added_per_file"
  while IFS= read -r -d '' p; do
    base=$(basename -- "$p")

    # Filename-level scan — always runs.
    if [ "$base" = ".env" ]; then
      printf '%s:%s\n' "$p" ".env-filename" >>"$SECRETS"
    fi

    # Content scan — skip doc files.
    if is_doc_path "$p"; then
      continue
    fi

    # Extract added lines for just this file. `git diff HEAD --` may produce
    # nothing for untracked files; that's fine, the grep stays empty.
    git diff HEAD -- "$p" 2>/dev/null | grep '^+' | grep -v '^+++' >"$ADDED_PER_FILE" || true
    [ -s "$ADDED_PER_FILE" ] || continue

    while IFS='|' read -r id pat; do
      [ -z "$id" ] && continue
      if grep -Eq "$pat" "$ADDED_PER_FILE" 2>/dev/null; then
        printf '%s:%s\n' "$p" "$id" >>"$SECRETS"
      fi
    done <"$PATTERNS_FILE"
  done <"$FILES_SORTED"
fi

# ---- JSON emission ----
# Small escape function: \ " newline cr tab control-bytes -> \uXXXX.
# Reads from stdin, writes escaped string body to stdout (no surrounding quotes).
json_escape() {
  python3 -c '
import sys, json
data = sys.stdin.buffer.read()
# Decode tolerantly; replace any byte we cannot represent.
text = data.decode("utf-8", errors="replace")
# json.dumps gives a fully-quoted string; strip the outer quotes.
print(json.dumps(text)[1:-1], end="")
' 2>/dev/null || {
    # Fallback: shell-only escape if python3 missing. Handles common chars.
    sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e ':a;N;$!ba;s/\n/\\n/g' -e 's/\r/\\r/g' -e 's/\t/\\t/g'
  }
}

# Build files array.
FILES_JSON="["
if [ "$FILE_COUNT" -gt 0 ]; then
  first=1
  while IFS= read -r -d '' p; do
    esc=$(printf '%s' "$p" | json_escape)
    if [ "$first" -eq 1 ]; then
      FILES_JSON="${FILES_JSON}\"${esc}\""
      first=0
    else
      FILES_JSON="${FILES_JSON},\"${esc}\""
    fi
  done <"$FILES_SORTED"
fi
FILES_JSON="${FILES_JSON}]"

# Build secrets array.
SECRETS_JSON="["
if [ -s "$SECRETS" ]; then
  first=1
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    esc=$(printf '%s' "$line" | json_escape)
    if [ "$first" -eq 1 ]; then
      SECRETS_JSON="${SECRETS_JSON}\"${esc}\""
      first=0
    else
      SECRETS_JSON="${SECRETS_JSON},\"${esc}\""
    fi
  done <"$SECRETS"
fi
SECRETS_JSON="${SECRETS_JSON}]"

printf '{"clean":%s,"ahead":%s,"files":%s,"diffStatBytes":%s,"secretsFound":%s}\n' \
  "$CLEAN" "$AHEAD" "$FILES_JSON" "$DIFF_STAT_BYTES" "$SECRETS_JSON"

# Exit policy.
if [ -s "$SECRETS" ]; then
  exit 2
fi
if [ "$CLEAN" = "true" ]; then
  exit 1
fi
exit 0
