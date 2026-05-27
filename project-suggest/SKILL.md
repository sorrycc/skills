---
name: project-suggest
description: Turn external context into a prioritized, project-grounded suggestion list. Trigger on "suggest improvements", "ideas for X", or pastes of news/PRs/articles.
disable-model-invocation: true
---

# project-suggest

Transform external signals into concrete, prioritized suggestions grounded in this project's actual conventions and in-flight work.

## Instructions

### Step 1 — Ground in the project (mandatory, before drafting any suggestion)

Read these in parallel. Do not skip — suggestions that ignore them get rejected by the user.

- `CLAUDE.md` / `AGENTS.md` / root `README.md` — runtime, package manager, lint/format, architecture rules, banned tools. Any proposal must comply.
- `docs/designs/`, `docs/rfcs/`, or `docs/adrs/` if present — existing or in-flight design work. Do **not** re-propose what's already designed/shipped; reference the doc and propose deltas instead.
- Any `contracts/`, `api/`, or equivalent boundary layer the project declares — flag any suggestion that would violate it.
- `skills/**/SKILL.md` and `.claude/skills/**/SKILL.md` — if a suggestion changes a CLI or user-facing surface that a skill documents, call out the required skill update in the same item.

If the input references a subsystem (e.g. logging, sessions, provider, attachments), also skim the relevant module under the project's source tree before suggesting changes there.

### Step 2 — Read the input context

The user will paste or point at one or more of:

- AI news digests / Twitter weekly
- Competitor product launches, PRs, blog posts
- Raw ideas, pain points, complaints
- Bug reports, issue threads
- Anything else

Extract concrete **signals** from it — specific quotes, dates, metrics, or behaviors — not vague vibes. A suggestion without a traceable signal is not useful.

### Step 3 — Generate suggestions

Produce a **prioritized list**. Each item uses this exact shape:

```
## N. <Short title> (urgency: P0 / P1 / P2)

**Signal**: <1–3 sentences citing the source — date, who said it, the concrete fact. Link or quote where possible.>

**Project impact**: <Why this matters specifically for this project given its architecture. Reference the actual module / file / contract it touches.>

**Action**: <Concrete change. Name the files or contracts to touch. If it's a multi-step effort, list the smallest first step that unblocks the rest. Mention any conventions from CLAUDE.md / AGENTS.md that shape the approach.>
```

Rules for the list:

1. **Rank by urgency**, not by topic. P0 = time-bound external pressure (policy change, security, breaking upstream). P1 = clear user pain or competitive gap. P2 = nice-to-have / strategic.
2. **Cap at 6 items** for the main list. More than that and the user won't act on any of them. Anything weaker goes in a short "Secondary / watch" tail.
3. **No duplicate proposals against existing design docs / RFCs / ADRs** — if one already covers it, say so and propose the delta only.
4. **Respect architecture rules** from `CLAUDE.md` / `AGENTS.md` (package boundaries, banned dependencies, type-only imports, etc.).
5. **Surface tradeoffs**: if an action has a real cost (refactor breadth, perf, vendor lock-in), state it in one sentence inside Action.
6. **Be specific about files**: prefer `src/feature/foo.ts` over "the feature layer". Speculation is fine when the user hasn't confirmed paths, but mark it.

### Step 4 — Close with next-step prompt

End with one or two sentences: which item to start with and why, and offer to drill into a specific one (read the relevant module and propose a finer-grained change plan). Do not start coding — this skill produces proposals, not patches.

## Output language

Match the user's language. If they wrote in Chinese, respond in Chinese (preserve English for code symbols, file paths, and proper nouns).

## Anti-patterns to avoid

- Vague suggestions ("improve performance", "add tests") with no file/contract anchor.
- Recommending tools or dependencies the project's `CLAUDE.md` / `AGENTS.md` explicitly bans.
- Re-proposing existing design docs / RFCs / ADRs without reading them first.
- Inflating item count to look thorough.
- Mixing "P0 because the news is recent" with actual urgency — recency ≠ urgency. A 6-month-old architectural debt can outrank a flashy launch.
