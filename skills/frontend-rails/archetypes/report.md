# Report / HTML artifact

People read these, so readability and structure come first.

## Layout

- Title, a one-paragraph summary, then sections.
- Body text inside `.prose` (keeps lines ~65–75 characters).
- Heading levels in order: h1 → h2 → h3. Don't skip.
- For long reports, a table of contents at the top or a sticky side list.

## Content

- Tables and charts beat long paragraphs for anything with numbers or comparisons.
- Put the conclusion first, then the evidence.
- Use `.alert-info` / `.alert-warning` for callouts, `<pre>` for code.
- Numbers in tables: `class="num"`.

## Check

- Run the gate with `--type report` (it checks light and dark mode).
- In the screenshots, the section structure should be clear without reading the text.
