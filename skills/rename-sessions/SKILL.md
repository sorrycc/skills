---
name: rename-sessions
description: Batch-rename past agent sessions of the current project to `MMDD｜TYPE｜Topic` (date from creation time in Asia/Shanghai, 8 fixed type codes, topic from content). Works on Claude Code, qodercli and Codex session stores, from any of the three hosts. Use when the user says rename sessions, rename conversations, tidy the session list, clean up the resume picker, or batch rename sessions.
argument-hint: '[claude|qoder|codex|all] [--limit N] [--zh] [--cwd <path>]'
disable-model-invocation: true
allowed-tools: Bash(bun ${CLAUDE_SKILL_DIR}/scripts/main.ts:*), Bash(bun ${QODER_SKILL_DIR}/scripts/main.ts:*)
---

# Rename sessions

Renames past sessions of the current project to `MMDD｜TYPE｜Topic`. Titles only. Nothing else in any store is touched.

## Script

`scripts/main.ts` sits next to this file. The host announces the directory as "Base directory for this skill"; in Claude Code it is also `${CLAUDE_SKILL_DIR}`, in qodercli `${QODER_SKILL_DIR}`. Always run it as `bun <that dir>/scripts/main.ts`. Run `--help` for all flags.

## Target

First argument: `claude`, `qoder`, `codex`, or `all`. If omitted, the script uses the host it runs in (`CLAUDE_CODE_SESSION_ID` → claude, `QODER_SESSION_ID` → qoder, `CODEX_THREAD_ID` → codex) and errors if none is set. Pass `--cwd` to target another project.

## Flow

1. List: `bun <dir>/scripts/main.ts list --tool <t> [--cwd <path>] [--limit 30] [--min-user 2]`
   Prints JSON per store: `id`, `created` (ISO), `date` and `mmdd` (already Asia/Shanghai), `title`, `titleSource`, `userMessages`, `excerpt` (first user prompts, last assistant message). Live sessions, the current session, tiny sessions, and already formatted titles are excluded and counted in `skipped`.
2. Decide one title per session from `excerpt` using the rules below. Leave out any session whose topic is unclear.
3. Print only this table and stop:

   | Session | Created | Before | After |

   `Session` is the first 8 characters of the id, `Created` is `date`. Wait for confirmation. Write nothing before it.
4. Apply: save the plan as `[{"id": "...", "title": "..."}]` to a temp file, then
   `bun <dir>/scripts/main.ts apply --tool <t> --plan <file>`.
   Report only the counts the script prints: written, skipped, failed, with reasons for the last two.

## Title rules

- Format `MMDD｜TYPE｜Topic`, full-width bar `｜`.
- TYPE codes, English by default, Chinese only when the user passes `--zh`, never mixed in one run:
  FEA/功能 feature · DES/设计 design · FIX/修复 bug fix · OPT/优化 optimization · REL/发布 release · EXP/探索 exploration · DOC/文档 docs · RES/研究 research
- Topic: what the session actually did. Short, specific, fits a sidebar, no project name.
- Unclear topic: leave the session out of the plan. Never guess.

## What the script guarantees

- Claude Code and qodercli: appends one `custom-title` record to the transcript and restores the file mtime so picker order does not change. Checks an existing record's shape first and refuses to write if the transcript format has changed. Skips sessions listed as live in `~/.claude/sessions` or `~/.qoder/sessions`.
- Codex: talks to `codex app-server` over stdio and calls `thread/name/set`, the same path the app uses. No direct sqlite writes. Lists interactive threads only, which is what the picker shows; `codex exec` runs are left alone. The desktop app refreshes on its next catalog scan; restart it if a name does not show.
