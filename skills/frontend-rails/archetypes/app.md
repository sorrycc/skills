# App screen / dashboard

People come here to get work done, so clarity and density matter more than looks.

## Layout

- Top bar or side nav for moving around. A page title with the main action on the right.
- Filters and actions in one toolbar row above the content.
- Use the full width for tables. Use cards only for things that really are separate.

## Data

- Numbers in tables: `class="num"` (right-aligned, tabular-nums). Put units in the header.
- Use status colors only for status: `.badge-success`, `.badge-danger`, etc.
- Dates and numbers formatted for people ("3 min ago", "1,204").
- Wide tables go inside `.table-wrap` so they scroll on phones.

## Every view needs four states

Build each one and check it in the screenshots:

1. **Loading**: `.skeleton` blocks shaped like the real content, or `.spinner` for small areas.
2. **Empty**: `.empty` with one sentence saying why it's empty and a button to fix it.
3. **Error**: `.alert-danger` saying what went wrong and what to do (retry button).
4. **Filled**: the normal view, with realistic data.

An easy way to show them all: put each state in its own section of the page, or add a small state switcher.

## Forms

- Label above each input (`.field`). Hint text below if needed.
- Show errors next to the field (`.error-text`, `aria-invalid="true"`).
- Disabled buttons use the `disabled` attribute.
