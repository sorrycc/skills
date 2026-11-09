---
name: frontend-rails
description: Build good-looking frontend pages (landing pages, app screens and dashboards, HTML reports) by picking a ready-made theme, building with its tokens, and checking the result with a browser script. Use when asked to make or redesign a web page, UI, dashboard, or HTML artifact.
---

# frontend-rails

You don't have to invent a look. Pick a theme, use its values, build, then let the gate script tell you what to fix.

`SKILL_DIR` below means the folder this file is in.

## 1. Read the project memory

If the project has a `DESIGN.md`, read it first. It says which theme was chosen, what was changed, and what the user has rejected. Don't bring back anything listed as rejected.

## 2. Pick the page type

- **landing**: marketing page, home page, product page
- **app**: dashboard, admin, settings, any screen with data or forms
- **report**: HTML report, doc, write-up, comparison, artifact

Read `archetypes/<type>.md`.

## 3. Pick a theme

Read `themes/INDEX.md` and pick the theme that fits the product. If `DESIGN.md` already names one, use that. Then read `themes/<name>/theme.md`.

Copy into the project:
- `themes/<name>/tokens.css` → `tokens.css`
- `components/primitives.css` → `primitives.css`

You can change token values to fit the brand (for example, set `--accent` to the brand color). You can add a token if you need one. Keep the names and put all values in `tokens.css`.

## 4. Build

- In `<head>`: the font `<link>` from the top of `tokens.css`, then `tokens.css`, then `primitives.css`, then your own CSS.
- Use `var(--…)` for every color, font, font size, spacing, radius, and duration.
- Use the classes in `components/usage.md` before writing new CSS.
- Write real copy. No lorem ipsum.

## 5. Motion (only if the page needs it)

Read `motion/motion.md`. Add motion after the page looks right without it.

## 6. Run the gate

First time only: `cd SKILL_DIR/gate && npm install`

```
node SKILL_DIR/gate/run.mjs page.html --type landing|app|report [--dark]
```

It opens the page at 1440, 768 and 390 px wide, saves screenshots to `.gate/` next to the page, and prints errors and warnings. Each line says what's wrong and where.

- Fix every **error**. Fix **warnings** when it's easy.
- Run it again. Stop after 3 rounds. If the same error is still there after 2 fixes, stop and tell the user what's left.
- If a rule is wrong for this project, add `ignore: R07` (optionally with a selector, like `ignore: R07 .pricing`) to the `gate` block in `DESIGN.md` and write down why.

## 7. Look at the screenshots

Start a subagent with fresh context. Give it only the brief and the screenshot paths from `.gate/`, not the code. Ask it the questions in `gate/vision-questions.md` for this page type. Fix every answer that points to a problem, then run the gate once more.

## 8. Update DESIGN.md

Create it from `templates/DESIGN.md` if it doesn't exist. Write down the theme, the tokens you changed, anything the user rejected, and any gate ignores or bans.
