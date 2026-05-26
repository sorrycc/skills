---
name: harness-self-improve
description: |
  Audit recent Claude Code work to find repeated manual workflows worth packaging into skills, subagents, slash commands, hooks, or cron jobs.
  Use when user says "self improve", "harness self improve", "audit my workflows", "find repeated work", "what should I package",
  or asks Claude to look back at recent sessions and suggest new skills/commands/hooks to create.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(ls *)
  - Bash(wc *)
  - Bash(grep *)
disable-model-invocation: true
---

# Harness Self-Improve

Audit recent Claude Code activity, identify repeated manual workflows, and package the high-value ones as skills, subagents, slash commands, hooks, or cron jobs.

**Protocol**: Phase 1 is read-only discovery → produce a ranked shortlist → **STOP and wait for my approval**. Phase 2 only runs after I explicitly approve specific items. Full details below.

**Approval format**: I'll reply with item numbers (e.g. "create 1, 3, 5" or "approve all"). If I say "approve all", still confirm hooks/cron individually before each write.

---

Look back over my recent work from the last 30 days (or the full history if it's shorter), and identify repeated manual workflows worth packaging.

## Sources of evidence

Use all of the following:

- Recent Claude Code sessions under `~/.claude/projects/<encoded-repo-path>/*.jsonl` (subdirectory names are absolute repo paths with `/` replaced by `-`) and per-repo `.claude/` artifacts. Don't read jsonl files in full — start by grepping for recurring verbs/nouns in user messages, then read only the matching session excerpts.
- `~/.claude/history.jsonl` (one prompt per line) as the cheap index for repeated phrasings or follow-ups that suggest a missing shortcut. Confirm important details in the relevant session transcript when needed.
- Memory files (`~/.claude/CLAUDE.md` and per-repo `CLAUDE.md`) to find patterns repeated across sessions.
- Existing skills, subagents, slash commands, hooks, and cron jobs — global under `~/.claude/{skills,agents,commands,hooks,output-styles}/` and per-repo under `<repo>/.claude/` — so you reuse or extend what already exists. Read the **description and trigger words** of existing assets, not just their names, before concluding that something is missing.

## What to look for

Look broadly for work that is repeated, time-consuming, error-prone, context-heavy, or benefits from a consistent process. Include workflows across coding, research, writing, planning, communication, operations, analysis, and personal administration.

Also look for **reverse signals**: cases where I performed work manually that an existing skill/command could have handled. That usually means the existing asset needs a better name, description, or scope — not a new parallel asset.

## High-confidence criteria

A candidate is high-confidence only if **all** of these hold:

- it occurred at least **3 times** across distinct sessions (or is clearly likely to recur and costly to repeat);
- each occurrence took **≥5 minutes** of manual effort or context-loading;
- it has stable inputs, a repeatable procedure, and a clear output or stopping condition;
- packaging it would materially improve speed, quality, consistency, or reliability;
- it is not already adequately covered (verified by reading existing asset descriptions and triggers).

**Default to extending an existing asset.** Only create a new one when extending would harm clarity or scope.

## Choosing the form

Choose the smallest appropriate form:

- **Skill** (`~/.claude/skills/<name>/SKILL.md` or `<repo>/.claude/skills/`): a reusable workflow or playbook. Use this when the workflow needs scripts, assets, reference docs, or should be triggered **semantically** from its description (without me typing a specific name).
- **Slash command** (`~/.claude/commands/<name>.md`): a short prompt template for a recurring one-shot phrasing that fits in a single prompt with no scripts/assets, and which I'm willing to invoke **explicitly** as `/name`.
- **Subagent** (`~/.claude/agents/<name>.md`): a bounded specialist role or investigation task suitable for delegation.
- **Automation**: an event-triggered hook in `settings.json` (PreToolUse / PostToolUse / Stop / UserPromptSubmit), or a recurring `CronCreate` job for scheduled checks, reports, reminders, or monitors.
- **Extend existing**: add to a current skill/subagent/command/hook instead of creating a parallel one.
- **Skip**: work that is too one-off, ambiguous, sensitive, or poorly evidenced to package.

## Privacy

Never quote secrets, tokens, API keys, or private third-party content (emails, private messages) into the shortlist or new skill files. Reference sessions by path and date, not by full content. If a candidate workflow only makes sense with sensitive data inline, skip it.

## Phase 1 — Shortlist (stop here and wait)

Produce a compact shortlist as a numbered markdown table, **capped at the top 10 candidates**, ranked by expected payoff (frequency × time saved per occurrence):

| # | Workflow | Evidence (paths/dates/snippets) | Frequency | Est. time saved | Recommended form | Why (or why not) |

If you found more than 10 worth mentioning, list the rest under a `### Also considered` section with one line each (no need for the full table).

Then **stop and wait for my approval** before creating anything. Phase 1 is **read-only**: do not create, modify, or delete any files. Only read and grep.

## Phase 2 — Create (only after I approve)

Create only the items I approve. Keep them narrow, practical, source-aware, and easy to validate. Place each asset at the correct scope: global (`~/.claude/...`) when it applies across projects, repo-local (`<repo>/.claude/...`) when it only makes sense inside one codebase.

For **hooks and cron jobs specifically**, confirm each one individually even if I approved the rest in bulk — they run automatically and can cause silent damage.

When **extending an existing asset**, show me the proposed diff first and wait for confirmation before writing.

For each newly created skill or command, include a one-line **"how to test"** hint at the bottom of the file (e.g. `# Test: say "analyze last week's helm logs"`) so I can verify the trigger works.

## Phase 3 — Report

Finish with:

- what you created or extended (with paths and the test hint for each)
- what you deliberately skipped and why
- what needs more evidence before packaging
- any existing assets whose **description/trigger** I should consider rewriting based on reverse signals you found

<!-- Test: say "harness self improve" or "audit my workflows from the last 30 days" -->
