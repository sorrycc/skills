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
| [karpathy-3d-story](skills/karpathy-3d-story/SKILL.md) | Build a multi-chapter animated 3D story — procedural three.js in one `scene.html`, deterministic and seeded, with a mandatory screenshot audit loop and optional ElevenLabs narration. Idea from [@karpathy](https://x.com/karpathy/status/2083749667410727319). |

## License

MIT — see [LICENSE](LICENSE).
