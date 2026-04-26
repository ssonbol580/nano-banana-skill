# Nano Banana — Claude Code Skill for Gemini Image Generation

A [Claude Code skill](https://docs.claude.com/en/docs/claude-code/skills) that teaches Claude how to generate and iteratively refine images using Google Gemini's native image generation API (codename **Nano Banana**).

Unlike diffusion models, Gemini's image models are **conversational** — there are no seeds, CFG scales, or strength sliders. You generate by describing what you want, and you iterate by continuing the conversation. This skill encodes the patterns, prompt-engineering rules, and self-QC loop required to use that mental model effectively.

## What's inside

- **`SKILL.md`** — the main skill file (loaded by Claude). Covers setup, models, the core API pattern, retry/timeout, three working methods (fresh generation, conversational iteration, image-to-image), batch generation, conversation forking, local file storage, the prompt-engineering summary, the implementation approach, and the Design Critic self-QC loop.
- **`references/prompt-engineering.md`** — the full prompt-engineering guide (typography, scale, spatial anchoring, negative guidance, color, common pitfalls).
- **`scripts/generate.ts`** — a reference TypeScript runner that implements the conversation-saving pattern.
- **`evals/evals.json`** — trigger-evaluation cases used to validate when the skill should activate.

## Models supported

| Model ID | Codename | Notes |
|---|---|---|
| `gemini-3.1-flash-image-preview` | Nano Banana 2 | Default — fast, thinking-enabled, up to 4K |
| `gemini-3-pro-image-preview` | Nano Banana Pro | Best quality, hero renders |
| `gemini-2.5-flash-image` | Nano Banana | Fallback — original model, up to 2K |

> Image-generation model IDs above are accurate at time of writing. The skill itself defers to upstream `gemini-interactions-api` for the canonical, always-current Gemini model list — so this README may lag, but the skill won't.

## Installation

Drop the `nano-banana/` directory into your Claude Code skills folder:

```bash
git clone https://github.com/ssonbol580/nano-banana-skill.git ~/.claude/skills/nano-banana
```

### Recommended companion: `gemini-interactions-api`

This skill defers to Google's officially-maintained [`gemini-interactions-api`](https://github.com/google-gemini/gemini-skills/tree/main/skills/gemini-interactions-api) skill for current model IDs, SDK package versions, and base API patterns — so `nano-banana` stays evergreen as Google ships new models. Install it into the same skills folder:

```bash
mkdir -p ~/.claude/skills/gemini-interactions-api && \
  curl -fsSL https://raw.githubusercontent.com/google-gemini/gemini-skills/main/skills/gemini-interactions-api/SKILL.md \
  -o ~/.claude/skills/gemini-interactions-api/SKILL.md
```

If the upstream skill isn't present, `nano-banana` will fall back to fetching it on demand. But having it installed locally is the smoother path.

### Project setup

```bash
npm install @google/genai
```

…and a `GEMINI_API_KEY` in `.env.local` (get one at https://aistudio.google.com/apikey).

## How Claude uses it

The skill activates only when you explicitly invoke it (e.g. "use the nano-banana skill to generate a hero image"). Once active, Claude will:

1. **Consult `gemini-interactions-api` first** for the current canonical model list and SDK syntax — so this skill never goes stale on Google's API surface.
2. Verify `@google/genai` and `GEMINI_API_KEY` are set up.
3. Write a tailored generation script that saves both the image and the conversation JSON (so you can iterate later).
4. Craft a prompt using the prompt-engineering rules — typography described with adjectives, spatial language for layout, explicit negative guidance.
5. Run the script and save the output to `.gemini-output/`.
6. **Read the generated image and run a QC checklist** — text accuracy, artifacts, layout, color, typography.
7. Auto-iterate (up to 3 rounds) on objective flaws like misspellings or missing elements, telling you what it's fixing.
8. Present the final image with structured commentary and suggested next iterations.

## License

MIT.
