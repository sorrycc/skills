---
name: create-skill
description: Scaffold a new Claude Code skill — create the skill directory and a well-formed SKILL.md (frontmatter + instructions). Use when the user wants to "create/new/scaffold a skill", "写个 skill", or "把这个流程做成 skill". First arg "global" saves to ~/.claude/skills, otherwise project ./.claude/skills.
disable-model-invocation: true
argument-hint: '[global] [skill description...]'
---

Create a new skill for the user.

## Instructions

1. **Determine save location**: Check whether the first argument token equals `global`.
   - If it does, save to `~/.claude/skills/<skill-name>/SKILL.md`, and treat the remaining tokens as the skill description.
   - Otherwise, save to `./.claude/skills/<skill-name>/SKILL.md` (project scope), and treat all tokens as the skill description.

   The **command name comes from the directory name** (`my-skill/` → `/my-skill`), not from the `name` field.

2. **Decide the skill type** — this drives the frontmatter:
   - **Reference skill** (conventions, domain knowledge, style guides): loaded inline alongside the conversation. Leave it model-invocable.
   - **Task skill** (deploy, commit, codegen, multi-step actions): add `disable-model-invocation: true` so it only runs as `/name` and Claude never fires it on its own — especially for anything with side effects.

3. **Gather information** (use arguments if provided, otherwise ask):
   - Skill name (directory name → the command)
   - Description (most important — see the rule below)
   - Body / instructions
   - Any optional frontmatter the skill actually needs (see reference.md)

   **description is the field that decides auto-loading.** Pack in (a) what it does, (b) when to use it, (c) the trigger words a user would naturally type — lead with the top use case. `description` + `when_to_use` are merged and **truncated to 1536 chars** in the skill listing, so front-load the essentials. If there are many trigger phrases, split them into a `when_to_use` field.

4. **Create the skill directory and SKILL.md.** Only `description` is recommended; every other field is optional (`name` defaults to the directory name). Minimal frontmatter:
   ```yaml
   ---
   name: <skill-name>            # display name only; usually = directory name
   description: <what it does + when to use + the words a user would actually say>
   # disable-model-invocation: true   # task skills / side effects — run only as /command
   # argument-hint: '<args>'          # autocomplete hint if it takes arguments
   # allowed-tools: Bash(git commit *) ...   # pre-approve only the tools it needs
   # paths: ["**/*.ts"]               # auto-activate only when matching files are touched
   # user-invocable: false            # hide from / menu for pure background knowledge
   ---
   ```
   For the full field set (`when_to_use`, `arguments`, `disallowed-tools`, `model`, `effort`, `context`/`agent`, `hooks`, `shell`), string-substitution variables, dynamic context injection, and the companion-file pattern, see [reference.md](reference.md).

5. **Keep the body lean.** Say WHAT to do, not why. Once loaded, the rendered SKILL.md stays resident across turns, so write standing instructions, not one-shot steps. Keep it under ~500 lines; move big reference/examples/long scripts into companion files and load them on demand. Reference scripts via `${CLAUDE_SKILL_DIR}/foo.sh`, never a hardcoded `.claude/skills` path.

6. **After creating, suggest a test**: try the natural phrasing (auto-trigger) and the direct `/skill-name` (manual) — confirm it both fires and does the right thing.

## Important

Propose the complete SKILL.md draft and the exact save path first. Create the directory and write the files only after the user confirms. If the skill's intent, name, or scope is unclear, ask before drafting.

## Arguments

$ARGUMENTS
