---
name: clawpatch-bugs
description: Run clawpatch, triage findings, write a prioritized bug list. Trigger on "run clawpatch", "clawpatch bug hunt", "scan for bugs".
disable-model-invocation: true
---

# clawpatch bug hunt

Two-phase bug discovery flow; the deliverable is a curated markdown file under `docs/bugs/`:

1. **Discover** — let `clawpatch` produce a raw bug report.
2. **Triage** — analyze each finding with parallel subagents, drop false positives / low-value noise, and save a curated, priority-sorted list.

The user already has `clawpatch` installed on `PATH`. Do not try to install it.

## Instructions

### Step 0 — Reset clawpatch workspace

Always start clean so a previous partial run does not contaminate this one:

```sh
rm -rf .clawpatch
```

### Step 1 — Run clawpatch and capture the raw report

Compute today's date as `YYYY-MM-DD` (use `date +%Y-%m-%d`). Use it for the output filename. Ensure `docs/bugs/` exists.

```sh
DATE=$(date +%Y-%m-%d)
mkdir -p docs/bugs

clawpatch init
clawpatch map
clawpatch review --limit 20
clawpatch report > docs/bugs/${DATE}-bugs.md
```

Notes:

- `clawpatch review --limit 20` may take a while; run it in the foreground and surface a single status line ("clawpatch reviewing…") rather than streaming its output.
- If any of the four `clawpatch` commands exits non-zero, stop and show the user the failing command's stderr. Do not proceed to step 2 on a partial report.
- After the report is written, tell the user the path and a one-line summary (count of findings).

### Step 2 — Analyze findings to filter out non-bugs

Read `docs/bugs/${DATE}-bugs.md` and parse out each finding (title + file refs + clawpatch's rationale).

For each finding, **spawn an `Explore` (or `general-purpose`) subagent in parallel** with a self-contained prompt:

- Hand it the finding's title, the cited file(s)/line(s), and clawpatch's claim verbatim.
- Tell it the goal: "Read the cited code in this repo and decide whether this is a real, currently-shipping bug worth filing — or a false positive / stylistic nit / already-handled case."
- Ask for a structured short reply: `VERDICT: real-bug | not-a-bug | low-value` followed by 2–4 sentences of evidence with `path:line` references.

Batch the subagent spawns: send them all in a single message (one `Agent` tool call per finding, all in parallel). Wait for all to return before continuing.

Aggregate the verdicts:

- **Keep** findings whose verdict is `real-bug`.
- **Drop** `not-a-bug` and `low-value` outright. Briefly note in the curated file how many were dropped and why (one sentence summary per dropped item is enough).

**Sort the kept bugs by priority** before writing the file. Use three buckets:

- **P0** — ship-blocking: data loss, crashes on a common code path, runaway resource use, fundamental breakage of a documented flow, destructive TOCTOU.
- **P1** — real user-facing bug, recoverable: bad UX, silent drops, broken automation, contract violations that affect real users.
- **P2** — polish / defense-in-depth / edge case / low-impact perf.

Within each bucket, order by your own judgment of impact (highest first). Renumber the kept bugs `1..N` in this final priority order (do not preserve clawpatch's emission order).

Write the curated list to:

```
docs/bugs/${DATE}-bugs-serious.md
```

Use this structure:

```markdown
# Serious bugs — <DATE>

Source: `docs/bugs/<DATE>-bugs.md` (clawpatch review, limit 20, <RAW_COUNT> raw findings).
Filtered by parallel subagent triage on <DATE> (one Explore agent per finding).

Kept <N> real bugs, sorted by priority (P0 → P1 → P2). Dropped <M>.

Priority guide:

- **P0** — ship-blocking: data loss, crashes, runaway resource use, fundamental breakage.
- **P1** — real user-facing bug, recoverable: bad UX, silent drops, broken automation.
- **P2** — polish / defense-in-depth / edge case / low-impact perf.

## P0 (<count>)

### 1. <short title>

- **Where:** `path/to/file.ts:LINE`
- **What clawpatch said:** <one-line summary>
- **Why it is real:** <subagent evidence, 2–4 sentences>
- **Suggested fix sketch:** <one or two sentences>

(repeat per finding, continuing the numbering across buckets)

## P1 (<count>)

### <next-number>. <short title>

...

## P2 (<count>)

### <next-number>. <short title>

...

## Dropped (<M>)

- <title> — <one-sentence reason it was dropped>
```

Tell the user where the file lives, the keep/drop counts, and the P0/P1/P2 split. The curated markdown is the deliverable — stop here.

## Guardrails

- **Never edit application code in this flow.** This skill only writes files under `docs/bugs/`.
- **Do not skip Step 0.** A stale `.clawpatch/` directory silently changes `review`/`report` behavior.
- **Do not run `clawpatch` against unrelated directories.** Always invoke from the repo root.
- **Subagent prompts must be self-contained** — they cannot see this conversation. Paste the finding text into each prompt verbatim.
- If `docs/bugs/${DATE}-bugs.md` already exists from an earlier run today, overwrite it (the Step 0 `rm -rf .clawpatch` plus a fresh `clawpatch report >` redirect already implies this — don't preserve the old file).
