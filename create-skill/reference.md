# Skill authoring reference

Companion to SKILL.md. Load this only when you need the full field set, substitution variables, or advanced patterns.

## Frontmatter fields

All fields are optional; only `description` is recommended.

| Field | Purpose |
|---|---|
| `name` | Display name in listings; defaults to the directory name. Does NOT change the command name (only a plugin-root SKILL.md is the exception). |
| `description` | What it does + when to use. Drives auto-invocation. Omitted → first paragraph of the body. Merged with `when_to_use` and truncated to 1536 chars in the listing — lead with the top use case. |
| `when_to_use` | Trigger phrases / example requests, appended to `description` (counts toward the 1536-char limit). |
| `argument-hint` | Autocomplete hint, e.g. `[issue-number]`. |
| `arguments` | Named positional params for `$name` substitution; space-separated string or YAML list. |
| `disable-model-invocation` | `true` = Claude won't auto-load it; manual `/name` only. Also keeps it out of preloaded subagents. |
| `user-invocable` | `false` = hidden from the `/` menu (pure background knowledge). |
| `allowed-tools` | Tools used without per-call approval while the skill is active. |
| `disallowed-tools` | Tools removed from the pool while active (cleared on next message). |
| `model` | Model used while the skill is active (this turn only). |
| `effort` | `low` / `medium` / `high` / `xhigh` / `max`. |
| `context` | `fork` = run the skill body as a subagent prompt (no access to your conversation history). |
| `agent` | With `context: fork`, the subagent type (`Explore` / `Plan` / `general-purpose` / custom). |
| `hooks` | Hooks bound to this skill's lifecycle. |
| `paths` | Glob(s); only auto-activate when matching files are being worked on. |
| `shell` | `bash` (default) or `powershell`. |

## Who can invoke

| Frontmatter | You | Claude | When the body loads |
|---|---|---|---|
| (default) | ✅ | ✅ | description resident; body loads on call |
| `disable-model-invocation: true` | ✅ | ❌ | description NOT in context; body loads when you call it |
| `user-invocable: false` | ❌ | ✅ | description resident; body loads when Claude calls it |

## String substitution

| Variable | Meaning |
|---|---|
| `$ARGUMENTS` | All passed args (if absent from the body, appended as `ARGUMENTS: <value>`). |
| `$ARGUMENTS[N]` / `$N` | 0-based positional arg (`$0` = first). |
| `$name` | Named arg declared in `arguments`, mapped by position. |
| `${CLAUDE_SESSION_ID}` | Current session ID. |
| `${CLAUDE_EFFORT}` | Current effort level. |
| `${CLAUDE_SKILL_DIR}` | The SKILL.md directory — reference companion scripts regardless of cwd. |

Positional args use shell-style quoting: `/my-skill "hello world" second` → `$0`=`hello world`, `$1`=`second`. Escape a literal `$` with a backslash (`\$1.00`).

## Dynamic context injection

`` !`<command>` `` runs a shell command *before* the content reaches Claude and inlines the output (preprocessing — not Claude executing):

```yaml
---
name: pr-summary
allowed-tools: Bash(gh *)
---
## PR context
- Diff: !`gh pr diff`
- Changed files: !`gh pr diff --name-only`
```

- Substituted once in the source; output is inserted as plain text and not re-scanned.
- Inline form only fires when `!` is at line start or after whitespace.
- Use a ` ```! ` fenced block for multi-line commands.

## Companion files

Put large reference docs / API specs / example sets in separate files and load them on demand:

```text
my-skill/
├── SKILL.md          # overview + navigation
├── reference.md      # loaded when needed
├── examples.md       # loaded when needed
└── scripts/helper.py # executed, not loaded into context
```

Reference them so Claude knows what each holds and when to load it:

```markdown
## Additional resources
- For full API details, see [reference.md](reference.md)
```

## Save locations

| Scope | Path |
|---|---|
| Personal (all your projects) | `~/.claude/skills/<name>/SKILL.md` |
| Project (this repo only) | `./.claude/skills/<name>/SKILL.md` |

Precedence on a name clash: Enterprise > Personal > Project; any level can override a bundled skill.

## Testing

"Triggered" ≠ "did the right thing." Test both: that it fires on the natural phrasing, and that the output matches intent. Compare a fresh session with the skill enabled vs. disabled on the same prompts.
