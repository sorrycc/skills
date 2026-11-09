# Screenshot questions

Give the reviewer (a fresh subagent) only the brief and the screenshot paths. Not the code.

Prompt to send:

> You are reviewing screenshots of a web page. Brief: <brief>. Screenshots: <paths> (1440, 768 and 390 px wide; `-dark` = dark mode).
> Answer each question with YES or NO, then name the exact element or area (e.g. "the pricing cards in the third section"). Don't give general advice.
> <questions>

## All pages

1. Is there one clear focal point on the first screen? If not, which elements compete?
2. Can you tell the 3 most important things on the page at a glance? Name them.
3. Does any area look like a generic template block (e.g. three identical feature cards, a stock hero)? Which?
4. At 390 px, is any text squeezed, cut off, or wrapping badly? Where?
5. Does anything look broken: overlapping elements, misaligned edges, empty gaps, missing images? Where?

## Landing

6. Does the headline say what the product is and who it's for?
7. Is there exactly one primary action that stands out?

## App

6. Are the loading, empty and error states each shown and designed (not plain text)? Which are missing?
7. Are numbers easy to scan and compare (aligned in columns)?

## Report

6. Without reading the words, can you see the section structure from the layout alone?
7. Does dark mode look as finished as light mode? What looks off?

Fix every answer that points to a problem. If an answer seems wrong after you look yourself, ignore it.
