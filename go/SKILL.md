---
name: go
description: Wrap up a finished dev task — commit and push.
---

# Go

Inspect git, write a commit message, stage, commit, push. Common path runs entirely in the parent agent via two co-located bash helpers. Subagent fallback only kicks in for huge diffs so they don't poison parent context.

## Scripts

`SKILL_DIR` = this SKILL.md file's directory (announced as "Base directory for this skill" when the skill loads). The two helpers live alongside this file at `${SKILL_DIR}/inspect.sh` and `${SKILL_DIR}/commit.sh`. **Always invoke them through `${SKILL_DIR}`** — never a hardcoded `.claude/skills/go/...` path, which only resolves when the skill happens to be installed in the current project and breaks on global/plugin installs.

## Flow

1. **Inspect.** Run `bash ${SKILL_DIR}/inspect.sh`. Parse the JSON blob on stdout. Branch on exit code:
   - `1` → print "nothing to do", stop.
   - `2` → print `Refusing to commit. Secrets found:` followed by `secretsFound[]` (each entry is `path:pattern-id`). If the match is clearly a documentation example or test fixture, defang the offending line (replace with an obvious placeholder like `<example-key>`) and re-run `bash ${SKILL_DIR}/inspect.sh` — the scan reads `git diff HEAD`, so worktree edits take effect without re-staging. Only stop unconditionally when a match looks like a real secret.
   - `0` → continue.

2. **Push-only shortcut.** If `files.length == 0` AND `ahead > 0`, the working tree is clean but unpushed commits exist. Run `git push` (use `-u origin HEAD` if no upstream). Print `Pushed <ahead> commit(s) on <branch>`. Stop.

3. **Prune junk.** Drop any path from `files[]` matching the denylist (see "Denylist" below). **Exception:** keep any path the user explicitly named in their `/go` prompt — user wins. After pruning:
   - If the pruned list is empty AND `ahead > 0` → fall back to the push-only shortcut (step 2). Surface the dropped paths so the user understands why no new commit was made.
   - If the pruned list is empty AND `ahead == 0` → stop with `nothing to do (all changes were junk: <paths>)`.
   - Otherwise continue with the pruned list. Mention any dropped paths in the final summary.

4. **Gate on size.** If `(pruned files.length) > 30` OR `diffStatBytes > 50000` → delegate to the subagent (see "Huge-diff fallback" below). Otherwise continue on the common path.

5. **Common path: write message + commit.** Synthesize a one-line conventional-commit message from the pruned `files[]` (and your knowledge of recent edits). Format `type: short summary` where `type` is one of `feat fix docs chore refactor test perf style build ci`. Then run:

   ```bash
   bash ${SKILL_DIR}/commit.sh "<message>" <path1> <path2> ...
   ```

   Parse the JSON from stdout:
   - `pushed:true` → print `Committed <sha> on <branch>`.
   - `pushed:false` → print `Committed <sha> on <branch>; push failed: <pushError>`.

   If the script exits `3` (bad message) — fix the prefix and retry. Exit `4` — you passed no paths; recover by re-running with the pruned `files[]`. Exit `5` is push-failure (already handled by the JSON branch above). Exit `6` — the project's format step failed; fix the underlying error and retry.

6. **Done.** Don't re-run `git status` to double-check. `inspect.sh` and `commit.sh` are the source of truth.

## Denylist (for step 3 prune)

- **Hard drop (directory-scoped):** any path under `node_modules/`, `dist/`, `build/`, `.next/`, `coverage/`.
- **Soft drop (basename):** `.DS_Store`, `Thumbs.db`, `*.log`.

A path the user named explicitly in their `/go` prompt overrides both tiers.

## Huge-diff fallback (for step 4)

When `(pruned files.length) > 30` OR `diffStatBytes > 50000`, the diff is too big to safely review in the parent's context. Spawn one `general-purpose` Agent (foreground) with the prompt below, passing the already-collected `files[]` and `diffStatBytes` as context so the subagent doesn't re-derive them. Print its summary verbatim.

### Agent prompt (pass verbatim, with the context block prepended)

> Context already gathered by the parent:
>
> - `files`: <the pruned files[] array as JSON>
> - `diffStatBytes`: <number>
>
> Finish a dev task in this project. Report back in under 80 words.
>
> 1. The parent already ran `git status`, `git diff HEAD`, and `git log @{u}..HEAD`. Treat the `files` list above as the changeset.
> 2. Abort if anything in the diff smells like a secret (the parent already scanned with regex; this is a second pair of eyes).
> 3. Run the project's format command from the repo root if one is configured (e.g. `bun run format` / `npm run format`); skip otherwise. If it exits non-zero, surface the error and stop — do not commit.
> 4. Commit — keep it to **one commit**:
>    - Stage by specific path (never `git add -A` / `git add .`).
>    - Message style `type: short summary` (`feat:`, `fix:`, `docs:`, `chore:`). HEREDOC. Never `--no-verify`. Never `--amend`.
> 5. `git push`. If no upstream, set it with `-u`. Never force-push.
> 6. Report: commit SHA and branch.

## Safety properties

- Secret scan is **scripted** in `inspect.sh` (regex against added lines of `git diff HEAD`, per-file). Removing an obsolete secret is allowed; adding one is hard-blocked. Content regexes are skipped for `*.md` / `*.mdx` / `*.txt` / `*.rst` (false-positive floor in design docs/READMEs was too high); the filename `.env` scan still applies to all paths.
- Commit message is **regex-validated** in `commit.sh` before any git mutation.
- Staging is **explicit-path only** (`git add -- "$@"`). Never `-A` / `.`.
- Push is **never** `--force` / `+refs`.
- Commit is **never** `--no-verify` or `--amend`.
- **Branch scope** — go commits and pushes on **whatever branch is currently checked out**; it never runs `git checkout -b`. If a `/go` commit lands on a feature branch, that branch came from an earlier step (e.g. the harness "branch first on the default branch" rule, or `/one-shot`), **not** from `/go`. When the current branch has no upstream, `commit.sh` pushes with `git push -u origin HEAD` — that publishes the current branch as a new remote branch, but does not create a local branch.
- `commit.sh` runs the project's format command before staging when both `bun` and a `scripts.format` entry are present; a missing formatter is skipped with a stderr note. Format failures hard-abort the commit (exit 6). Whole-repo scope; unrelated drift may surface on the next `/go`.
