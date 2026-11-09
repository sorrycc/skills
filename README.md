# Skills

A collection of my custom agent skills, distributed as a Claude Code plugin marketplace.

## Install

### Via plugin marketplace (recommended)

```
/plugin marketplace add sorrycc/skills
/plugin install cc-skills@cc-skills
```

Then run `/skills` to see everything that's available.

To pick up new skills later:

```
/plugin marketplace update cc-skills
```

### Via npx

```bash
npx skills add sorrycc/skills
```

## Skills

| Skill | Description |
|-------|-------------|
| [create-skill](skills/create-skill/SKILL.md) | Scaffold a new skill — creates the directory and a well-formed SKILL.md. |
| [frontend-rails](skills/frontend-rails/SKILL.md) | Build good-looking frontend pages from a ready-made theme, then check them with a browser gate script. [Demo](https://sorrycc.github.io/frontend-rails/examples/) |

## License

MIT — see [LICENSE](LICENSE).
