# Copy

Generated interfaces read like a manual. Every section gets a slogan, a subtitle and helper text. Write less and let the layout explain.

## Cut

- Taglines, subtitles under every heading, helper text under every field, labels that repeat what the control already shows.
- If a page can't be understood without them, change the layout. Group related things, order them the way people work, make the main action the biggest thing.
- Explanations that only some people need go behind an info icon with `data-tip`, not on the page.
- Rows of things chained with "·". Use columns or rows.

The gate helps here. `.gate/1440-nocopy.png` is the page with secondary text hidden. Whatever nobody would miss, delete.

## Keep

Cutting too hard gives a page that looks like Linear in a screenshot and that nobody can use the first time.

- Every form control keeps its label.
- Every icon-only button keeps an `aria-label` and a `data-tip`.
- A first-time user can see the first thing to do without reading anything else. Empty states say it outright.
- Errors say what happened and what to do next.

## Words

- One action, one verb, across the whole product. If it's "Delete" here it isn't "Remove" there. Record the choice in `DESIGN.md` (`verb: delete`) and the gate holds every page to it.
- Buttons say what happens ("Create invoice"), in sentence case. Not "Submit", not "OK", not ALL CAPS.
- Don't push. No "Buy now", "Hurry", "Only 3 left".
- Use the words the platform and the user's language already use. Don't translate word for word.
- Menu and nav names: one or two words. Descriptions: under 20 words.

## Numbers and dates

- Give the unit, the way people write it for that kind of number (money, distance, time).
- `Intl.PluralRules` for counts. "1 member", never "1 members".
- Relative time up to a week ("3 min ago", "Yesterday, 17:40"). After that the date itself.
- Lay out for the longest translation. You may reword. Don't shrink the type or cut the text off.
