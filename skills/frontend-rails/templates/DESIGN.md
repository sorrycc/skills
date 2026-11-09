# Design

## Theme

<theme name> — picked <date>. Why: <one line>

## Changed tokens

- `--accent: #…` — brand color

## Rejected

Things the user said no to. Don't bring them back.

- <date> <what> — "<what the user said>"

## Accepted

Pages or parts the user liked, to match in future work.

- <page or screenshot path>

## Gate

Rules for `gate/run.mjs`. `ignore: <rule> [selector]` skips a rule; `ban: <css-property>` makes any use of that property an error.

```gate
# ignore: R07 .pricing    # why: the user wants three plan cards
# ban: backdrop-filter    # user rejected glass effects
```
