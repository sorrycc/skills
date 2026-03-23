---
name: model-committee
description: "Multi-model committee for research and analysis. Dispatches the same question to multiple AI models in parallel, then synthesizes results showing consensus and disagreements."
---

# Model Committee

Dispatch a question to multiple AI models in parallel, collect their independent answers, and synthesize a report highlighting consensus and disagreements.

## Skill Directory

1. `SKILL_DIR` = this SKILL.md file's directory
2. Model config = `${SKILL_DIR}/EXTEND.md`

## Step 1 - Read Model Config

Read `${SKILL_DIR}/EXTEND.md`. This file defines which models are available and how to run them.

- If the file **does not exist**, tell the user the skill is missing its config file, and provide this minimal template for them to create at `${SKILL_DIR}/EXTEND.md`:

```markdown
# EXTEND.md

## Models

### Claude Opus
- type: claude-agent
- model: opus

### GPT
- type: cli
- command: codex exec --full-auto "$PROMPT"
```

Then stop and wait.

- If the file **exists**, parse all model entries. Each entry should have:
  - **name**: display name (from heading)
  - **type**: `claude-agent` or `cli`
  - **model** (for claude-agent): one of `opus`, `sonnet`, `haiku`
  - **command** (for cli): shell command with `$PROMPT` placeholder

The file is free-format markdown. Parse it flexibly — look for model headings, type indicators, and commands. Do not require rigid structure.

## Step 2 - Dispatch to All Models in Parallel

Take the user's question and send it to every model defined in EXTEND.md **simultaneously**.

### For `claude-agent` type models

Use the **Agent tool** with:
- `model` set to the specified model (opus/sonnet/haiku)
- `description`: "Committee: {model-name}"
- `prompt`: Include the user's full question. Instruct the agent to think deeply, provide a thorough answer with reasoning, and clearly state its conclusion.

### For `cli` type models

Use the **Bash tool** with:
- Replace `$PROMPT` in the command string with the user's question (properly escaped for shell)
- Set a reasonable timeout (60-120 seconds)

**Important**: Launch ALL agents and CLI calls in a single message to maximize parallelism. Use `run_in_background: true` for Agent calls if there are many models.

## Step 3 - Synthesize Results

Once all model responses are collected, produce a structured report:

```
## Model Committee Report

### Question
{the original question}

### Individual Responses

#### {Model Name 1}
{summary of this model's response and conclusion}

#### {Model Name 2}
{summary of this model's response and conclusion}

...

### Consensus
{points where all or most models agree}

### Disagreements
{points where models diverge, noting which model holds which position}

### Synthesis
{your overall assessment combining the strongest arguments from each model}
```

## Key Principles

- **Independence**: Each model must answer independently — do not share one model's answer with another
- **Faithfulness**: Summarize each model's response accurately, do not editorialize in the individual sections
- **Balanced synthesis**: The final synthesis should weigh arguments by quality, not just majority vote
- **Transparency**: Always show which model said what, so the user can judge for themselves
