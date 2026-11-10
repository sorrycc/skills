# Design

## Theme

<theme name>, picked <date>. Why: <one line>

## Changed tokens

- `--accent: #…` (brand color)

## Main task

What a first-time user comes here to do, in their words. The walkthrough tests this.

- <e.g. "start a deploy of the main branch">

## Words

One action, one verb. Add the verb to the gate block below too.

- Delete (not Remove, not Trash)

## Rejected

Things the user said no to. Don't bring them back. Each one also gets a line in the gate block.

- <date> <what>: "<what the user said>"

## Accepted

Pages or parts the user liked, to match in future work.

- <page or screenshot path>

## Gate

Rules for `gate/run.mjs`, one per line.

- `ignore: <rule> [selector]` skips a rule
- `ban: <css-property>` makes any use of it an error; `ban: <property>: <value>` bans one value
- `ban-text: <wording>` makes that wording an error
- `verb: <word>` is the one word for that action; other words for it become errors
- `freq: constant|often <selector>` says how often people see it, which decides whether it may animate
- `states: <names>` lists the view states the page shows for `?state=<name>`

```gate
# ignore: R07 .pricing            # the user wants three plan cards
# ban: backdrop-filter            # user rejected glass effects
# ban-text: Get started           # user wants "Create account"
# verb: delete
# freq: constant .command-palette
# states: loading empty error
```
