# Screenshot questions

Give the reviewer (a fresh subagent) only the brief and the screenshot paths. Not the code.

Prompt to send:

> You are reviewing screenshots of a web page. Brief: <brief>. Screenshots: <paths>.
> `1440`, `768`, `390` are page widths; `-dark` is dark mode; `state-<name>` is one view state; `break-*` is the page with long content forced in; `1440-nocopy` is the page with secondary text hidden; `motion-*` is six frames of something opening (top row) and closing (bottom row), with the time under each frame.
> Answer each question with YES or NO, then name the exact element or area (e.g. "the pricing cards in the third section"). Don't give general advice.
> <questions>

## All pages

1. Is there one clear focal point on the first screen? If not, which elements compete?
2. Can you tell the 3 most important things on the page at a glance? Name them.
3. Does any area look like a generic template block (e.g. three identical feature cards, a stock hero)? Which?
4. At 390 px, is any text squeezed, cut off, or wrapping badly? Where?
5. Does anything look broken: overlapping elements, misaligned edges, empty gaps, missing images? Where?
6. Is there more than one accent colour, or a shadow, glow or frosted panel on something that isn't floating? Where?
7. Compare `1440` with `1440-nocopy`. Which of the hidden text would a first-time user miss? Name each piece. Everything you don't name gets deleted.
8. In `break-1440` and `break-390`, does anything overlap, spill out of its box, or push a button off screen? Where?

## Motion strips (if any `motion-*` exist)

9. Does the thing grow from the control that opened it, or does it appear from somewhere unrelated?
10. Is any frame ugly on its own: text overlapping text, a half-drawn shadow, something visibly larger than its final size?
11. Is closing quicker and smaller than opening?

## Landing

12. Does the headline say what the product is and who it's for?
13. Is there exactly one primary action that stands out?

## App

12. Is each of `state-loading`, `state-empty` and `state-error` designed, not plain text? Which isn't?
13. Flip between `state-filled` and the other states. Does the title, toolbar or nav move or change size? Where?
14. Does the loading skeleton have the shape of the filled content?
15. From the empty state alone, is it clear what to do first?
16. Are numbers easy to scan and compare (aligned in columns)?

## Report

12. Without reading the words, can you see the section structure from the layout alone?
13. Does dark mode look as finished as light mode? What looks off?

Fix every answer that points to a problem. If an answer seems wrong after you look yourself, ignore it.
