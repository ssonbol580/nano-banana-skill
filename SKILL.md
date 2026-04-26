---
name: nano-banana
description: "Generate and iteratively refine images using Gemini's native image generation API (Nano Banana). Covers text-to-image, image-to-image editing, multi-turn conversational iteration, and batch generation. Only use when explicitly invoked by the user."
---

# Nano Banana — Gemini Image Generation

This skill encodes battle-tested patterns for generating and iterating on images using Google's Gemini image models. The name comes from the internal codename for Gemini's native image generation capability.

Gemini image models are **conversational**, not diffusion-based. There are no seeds, CFG scales, or strength parameters. You generate by describing what you want, and you iterate by continuing the conversation. This is the fundamental mental model — iteration is a conversation, not parameter tuning.

## Live Source of Truth — Check First

Before generating any code or referencing model IDs / SDK syntax, **invoke the `gemini-interactions-api` skill** (maintained by Google). It is the canonical source for:

- Current Gemini model IDs and availability — deprecations happen, and what was current when this skill was written may not be current today
- Current SDK package names and minimum versions (`@google/genai` for JS/TS, `google-genai` for Python)
- Base API patterns for `generateContent`, conversation state, and tool calling

This skill (`nano-banana`) builds **on top of** `gemini-interactions-api`. It adds the image-generation-specific layer:
- Image-generation prompt engineering (typography, spatial anchoring, negative guidance)
- Three working methods (fresh, conversational iteration, image-to-image) with conversation forking
- The Design Critic self-QC loop
- Local conversation storage for cross-session iteration

**Conflict rule:** if anything in this skill conflicts with `gemini-interactions-api` (model IDs, SDK syntax, package versions), defer to that skill — it is authoritative.

If `gemini-interactions-api` is not installed locally, fetch the latest from https://raw.githubusercontent.com/google-gemini/gemini-skills/main/skills/gemini-interactions-api/SKILL.md and apply it before proceeding.

## Setup

The skill requires the `@google/genai` npm package and a `GEMINI_API_KEY`.

```bash
npm install @google/genai
```

If the project doesn't have this dependency, install it before proceeding.

### API Key Resolution

Look for `GEMINI_API_KEY` in this order:
1. **Current project's `.env.local`** — check first, this is the most common location for Next.js/Vercel projects
2. **Current project's `.env`** — fallback
3. **`process.env.GEMINI_API_KEY`** — already set in the shell environment
4. **`~/.env`** or shell profile — some users export it globally

When writing generation scripts, load the key from the project's env file using `dotenv` if `process.env.GEMINI_API_KEY` isn't already set:

```typescript
import { config } from "dotenv";
config({ path: ".env.local" }); // Load project's env file
// Falls through to .env automatically if .env.local doesn't exist

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("GEMINI_API_KEY not found. Add it to .env.local or set it in your environment.");
```

If no key is found anywhere, tell the user to get one from Google AI Studio (https://aistudio.google.com/apikey) and add it to their project's `.env.local`.

## Models

> **Source of truth:** `gemini-interactions-api` maintains the canonical, current Gemini model list. The table below covers **image-generation models specifically** — codenames, image-gen-only capabilities, and selection guidance. If any model below shows as deprecated upstream, use upstream's recommended replacement.

| Model ID | Codename | Best For | Thinking | Max Resolution |
|---|---|---|---|---|
| `gemini-3.1-flash-image-preview` | Nano Banana 2 | Default — fast, thinking-enabled, great for iteration | Controllable (`Minimal` / `High`) | 4K |
| `gemini-3-pro-image-preview` | Nano Banana Pro | Best quality, hero renders (may be unavailable/slow) | Controllable (`Minimal` / `High`) | 4K |
| `gemini-2.5-flash-image` | Nano Banana | Fallback — fast, good quality, original model | None | 2K |

**Default to 3.1 Flash (Nano Banana 2)** unless the user asks for maximum quality (use 3 Pro / Nano Banana Pro) or 3.1 Flash has issues (fall back to 2.5 Flash). Both 3.x models support thinking levels. If any model returns 503, tell the user it's overloaded and suggest trying a different model.

### Nano Banana 2 (3.1 Flash) exclusive features
- 512px resolution option (for pixel art, thumbnails, fast drafts)
- Extra aspect ratios: `1:4`, `4:1`, `1:8`, `8:1`
- Image Search grounding (pass `tools: [{ google_search: {} }]` with `searchTypes` containing `imageSearch`)

## Core API Pattern

> Basic SDK setup (client construction, auth, generic `generateContent` skeleton) is covered in `gemini-interactions-api`. The pattern below focuses on **image-generation-specific config**: `responseModalities`, `imageConfig` (aspect ratio, image size), and `thinkingConfig` for the 3.x image models.

Every Gemini image generation call follows this structure:

```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const response = await ai.models.generateContent({
  model: "gemini-3.1-flash-image-preview",
  contents: [
    {
      role: "user",
      parts: [
        // Optional: reference image as inline data
        { inlineData: { mimeType: "image/png", data: base64String } },
        // Required: text prompt
        { text: "your prompt here" },
      ],
    },
  ],
  config: {
    responseModalities: ["TEXT", "IMAGE"],  // or ["IMAGE"] for image-only output
    // For 3.x models (3.1 Flash or 3 Pro):
    thinkingConfig: {
      thinkingLevel: "High",    // "Minimal" or "High" (capitalized)
      includeThoughts: true,    // set true to inspect model reasoning
    },
    // Image settings:
    imageConfig: {
      aspectRatio: "1:1",  // see full list below
      imageSize: "2K",     // "512", "1K", "2K", "4K"
    },
  },
});

// Extract results
const parts = response.candidates?.[0]?.content?.parts ?? [];
let imageBase64: string | null = null;
let modelText = "";

for (const part of parts) {
  if ("inlineData" in part && part.inlineData) {
    imageBase64 = part.inlineData.data;
  }
  if ("text" in part && part.text && !part.thought) {
    modelText += part.text;
  }
}
```

Key details:
- `responseModalities`: Use `["TEXT", "IMAGE"]` for text + image output, or `["IMAGE"]` for image-only. Note: image-only mode does NOT work with grounding/search tools.
- **Do NOT pass `temperature`** — image generation does not use temperature. Omit it entirely from the config.
- Filter out `part.thought === true` when collecting model text (these are internal reasoning)
- The model may return text alongside the image — this is normal and can contain useful context
- `thinkingConfig` works on BOTH `gemini-3.1-flash-image-preview` and `gemini-3-pro-image-preview`. Omit it for `gemini-2.5-flash-image`. Capitalize the level: `"Minimal"` or `"High"`
- `includeThoughts: true` in thinkingConfig lets you inspect the model's reasoning (useful for debugging prompt issues)
- **Aspect ratios**: `"1:1"`, `"1:4"`, `"1:8"`, `"2:3"`, `"3:2"`, `"3:4"`, `"4:1"`, `"4:3"`, `"4:5"`, `"5:4"`, `"8:1"`, `"9:16"`, `"16:9"`, `"21:9"` (1:4, 4:1, 1:8, 8:1 are Nano Banana 2 exclusive)
- **Image sizes**: `"512"` (Nano Banana 2 only), `"1K"`, `"2K"`, `"4K"` (3.x models only for 4K)

## Retry & Timeout

Always wrap generation calls with timeout and retry logic:

```typescript
const TIMEOUT_MS = 60_000;  // 60 seconds
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 5_000;

for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
  try {
    const apiCall = ai.models.generateContent({ model, contents, config });
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Gemini request timed out")), TIMEOUT_MS)
    );
    const response = await Promise.race([apiCall, timeout]);
    // ... extract image ...
    break;
  } catch (e) {
    if (e.status === 503) {
      throw new Error("Model overloaded. Try a different model or try again later.");
    }
    if (attempt < MAX_RETRIES - 1) {
      await new Promise(r => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)));
    } else {
      throw e;
    }
  }
}
```

- 503 = model overloaded — fail fast, don't retry
- Other errors — retry with exponential backoff
- 60s timeout is a good default; generation typically takes 20-45 seconds

## Three Methods of Working

### Method 1: Fresh Generation (Text → Image)

Generate a new image from a text prompt, optionally with a reference image.

```typescript
const contents = [{
  role: "user",
  parts: [
    // Include reference image if doing image-to-image:
    // { inlineData: { mimeType: "image/png", data: referenceImageBase64 } },
    { text: prompt },
  ],
}];
```

Save the full model response for potential future iteration:
```typescript
const modelContent = response.candidates?.[0]?.content ?? { role: "model", parts: [] };
const conversation = [userContent, modelContent];
// Save conversation to .gemini-conversations/<id>.json
```

### Method 2: Conversational Iteration (Multi-turn Refinement)

The most powerful pattern. Gemini remembers what it generated and can make targeted edits.

```typescript
// Load previous conversation
const conversation = JSON.parse(fs.readFileSync(conversationPath, "utf-8"));

// Append new instruction
const newUserTurn = { role: "user", parts: [{ text: "Make the sky more dramatic" }] };
const contents = [...conversation, newUserTurn];

const response = await ai.models.generateContent({ model, contents, config });

// Save updated conversation (including the new model response)
const modelContent = response.candidates?.[0]?.content;
const updated = [...contents, modelContent];
fs.writeFileSync(conversationPath, JSON.stringify(updated, null, 2));
```

**Critical: Thought Signature Preservation.** Gemini 3.x models return opaque `thought_signature` fields in their response parts. These MUST be preserved exactly as returned — they are required for multi-turn continuity. Always store the complete `response.candidates[0].content` object, never reconstruct it or strip fields.

**After 4-5 iteration turns**, suggest starting fresh. Long conversations accumulate artifacts and drift.

### Method 3: Image-to-Image Editing

Send an existing image with editing instructions:

```typescript
const imageBuffer = fs.readFileSync("input.png");
const imageBase64 = imageBuffer.toString("base64");

const contents = [
  {
    role: "user",
    parts: [
      { inlineData: { mimeType: "image/png", data: imageBase64 } },
      { text: "Change the background to a sunset beach scene" },
    ],
  },
];
```

For text-only edits on an image (typo fixes), be very specific in your prompt:
```typescript
// prompt: "Change the text 'TANGARINE' to 'TANGERINE'. Keep everything else exactly the same."
```

Text-only editing is fragile — it works for isolated text changes but causes visual artifacts ("smudging") when used for moving elements, changing colors, or resizing. If a text edit fails (no image returned), fall back to fresh generation with the correction baked into the prompt.

## Batch Generation

For generating multiple variations concurrently:

```typescript
const CONCURRENCY = 3;  // max 5 to avoid rate limits
const STAGGER_MS = 1000;  // delay between requests in a wave

async function generateBatch(variations) {
  const results = [];
  
  for (let i = 0; i < variations.length; i += CONCURRENCY) {
    const wave = variations.slice(i, i + CONCURRENCY);
    const promises = wave.map((v, idx) =>
      new Promise(resolve => setTimeout(resolve, idx * STAGGER_MS))
        .then(() => generateSingle(v))
        .then(result => ({ status: "success", result }))
        .catch(error => ({ status: "failed", error: error.message }))
    );
    const waveResults = await Promise.allSettled(promises);
    results.push(...waveResults.map(r => r.value));
  }
  
  return results;
}
```

- Max 10 variations per batch
- Process in waves of 3 (max 5) with 1-second stagger between requests within a wave
- Use `Promise.allSettled` so one failure doesn't kill the batch
- At ~30s per generation, a batch of 10 at concurrency 3 takes ~2-3 minutes

### Batch Iteration (Forking)

To create variations of an existing image, fork the conversation for each variation:

```typescript
// Load the parent conversation
const parentConversation = JSON.parse(fs.readFileSync(parentPath, "utf-8"));

// Each variation gets its own INDEPENDENT copy
for (const variation of variations) {
  const forkedConversation = JSON.parse(JSON.stringify(parentConversation)); // deep clone
  const contents = [...forkedConversation, {
    role: "user",
    parts: [{ text: variation.instruction }],
  }];
  // Generate and save each fork separately
}
```

Each fork is independent — they share the parent history but diverge from there. This is safe for concurrent execution.

## Local File Storage

Without a database, store everything on the local filesystem:

```
.gemini-output/
  images/
    gen-001.png
    gen-002.png
  conversations/
    conv-001.json    # Full Gemini Content[] array
    conv-002.json
  index.json         # Maps generation IDs to metadata
```

The index.json tracks relationships:
```json
{
  "generations": [
    {
      "id": "gen-001",
      "conversationId": "conv-001",
      "parentId": null,
      "prompt": "...",
      "model": "gemini-3.1-flash-image-preview",
      "timestamp": "2025-...",
      "aspectRatio": "1:1"
    }
  ]
}
```

When the user wants to iterate on a previous generation, load the conversation file by looking up the `conversationId` in the index.

## Prompt Engineering Guide

Read `references/prompt-engineering.md` for the full guide. The key principles are summarized here:

### Typography
AI image models "paint" text — they have no font files. Describe typography with adjectives, never font names:
- Helvetica/Arial → "clean, modern, bold sans-serif typography"
- Times/Garamond → "elegant, classic serif with high contrast strokes"
- Impact → "heavy, blocky, condensed lettering"
- Luxury/Fashion → "ultra-thin, minimalist, tracked-out sans-serif"

### Size & Scale
Never use pixels or point sizes. Use spatial language:
- Large: "prominent," "spanning the full width," "edge-to-edge"
- Medium: "centered," "clearly visible," "proportional"
- Small: "subtle," "understated," "compact," "tucked away"
- Avoid "massive/oversized" — causes overflow. Use "prominent, spanning" instead.

### Spatial Anchoring
Use relative spatial language to position elements:
- "Occupying the top third of the image" (not "at the top")
- "A band cutting across the entire width of the lower half"
- "Spanning the full vertical height of the left edge"

### Negative Guidance
Always append what NOT to include. Example:
> "Do NOT include: distorted text, misspelled words, extra floating elements, watermarks, blurry regions, or any text not specified in the prompt."

### Color
Use specific descriptors: "warm honey gold" not "yellow", "deep forest green" not "green". Ensure color harmony across elements. When using dark backgrounds, explicitly describe contrast.

### Critical Pitfalls
1. **Emphasis requires dual description** — to emphasize text (like making "FREE" bold), describe it in BOTH the text content AND the style description
2. **Keep to 2-3 typography styles** per image — mixing too many creates visual chaos
3. **Cursive/handwritten fonts render inconsistently** — prefer clean sans-serif unless specifically requested
4. **"Massive/oversized" causes overflow** — use "prominent, spanning" instead
5. **Keep iteration instructions short** — Gemini has full conversation context, no need to re-describe everything
6. **The 90/10 rule** — AI gets 0→90% instantly. The last 10% (exact kerning, pixel-perfect alignment) is often faster to finish in a real editor. Focus on getting creative direction, colors, and layout right.

## Implementation Approach

When the user asks you to generate an image:

1. **Check setup** — ensure `@google/genai` is installed and `GEMINI_API_KEY` is available
2. **Write a generation script** — create a standalone script (TypeScript or JavaScript) in the project that implements the patterns above. The script must save both the image AND the conversation JSON (for iteration). Tailor the script to the specific task.
3. **Craft the prompt** using the prompt engineering principles — describe typography with adjectives, use spatial language for positioning, include negative guidance
4. **Run the script** — execute it and save the output image
5. **QC Inspect** — read the generated image and run the Design Critic evaluation (see below)
6. **Auto-iterate or present** — if obvious flaws are found, auto-iterate (up to 3 rounds). If the image passes QC, show it to the user with commentary and suggestions.

For projects that will do repeated generation, consider creating a reusable module rather than one-off scripts. The conversation storage pattern (JSON files) enables iteration across sessions.

## Design Critic Loop (Self-QC)

After every generation, you MUST inspect the output image before presenting it to the user. Use the Read tool to view the generated image, then evaluate it. This is the core quality control loop that separates good results from great ones.

### The Loop

```
Generate image → Save to disk → Read image with Read tool
                                        ↓
                                Run QC Checklist
                                        ↓
                        ┌── Obvious flaw found?
                        │     YES → Auto-iterate (craft fix prompt,
                        │            run via conversation iteration,
                        │            note to user what you fixed)
                        │            → Re-inspect (max 3 auto-iterations)
                        │
                        └── No obvious flaws?
                              → Present to user with:
                                 - What went well
                                 - Minor observations (not dealbreakers)
                                 - Suggested next iterations if relevant
```

### QC Checklist

Evaluate every generated image against these criteria, in order of severity:

**Critical (auto-iterate immediately):**
1. **Text accuracy** — Is every word spelled correctly? Is any requested text missing entirely? Is there phantom text that wasn't asked for? *This is the #1 failure mode of AI image generation.*
2. **Gross artifacts** — Smudged regions, floating disconnected elements, obvious visual glitches, elements bleeding off the edge, duplicated subjects
3. **Wrong subject** — The image shows something fundamentally different from what was requested (e.g., asked for a dog, got a cat)

**Important (auto-iterate if clearly wrong, otherwise note to user):**
4. **Layout/composition** — Are elements positioned roughly where the prompt described? Is the spatial anchoring honored? Is the visual hierarchy readable?
5. **Color accuracy** — Does the palette match what was described? Are colors in the right places? (e.g., if "gold text on black background" was requested, is the text actually gold?)
6. **Typography quality** — Is text legible? Are font styles roughly matching the description (serif vs sans-serif, heavy vs thin)? Are there too many conflicting styles?

**Observations (note to user, don't auto-iterate):**
7. **Composition polish** — Balance, whitespace, visual flow. These are subjective.
8. **Color harmony** — Could the palette be more cohesive? Suggest adjustments.
9. **Style consistency** — Does the overall aesthetic match the intent?
10. **The 90/10 gap** — What would need manual editing in Figma/Photoshop vs more Gemini iterations?

### How to Auto-Iterate

When you find a critical or important flaw, craft a short, specific iteration prompt. Gemini already has full context of what it generated — don't re-describe the whole image.

**Good iteration prompts (specific, short):**
- "The word 'SUMMER' is misspelled as 'SUMEMR' — fix the spelling to 'SUMMER', keep everything else the same"
- "There's a floating white shape in the upper right that shouldn't be there — remove it"
- "The headline text is barely visible against the background — make it bolder and add a subtle drop shadow for contrast"
- "The flavor bar is missing entirely — add a wide gold rectangular bar in the lower third with 'TANGERINE' in white text"

**Bad iteration prompts (too vague or re-describes everything):**
- "Fix the text" (which text? what's wrong?)
- "Make it better" (how?)
- "Regenerate the image with the correct text and the right colors and the proper layout and..." (too long, re-describing)

Load the saved conversation JSON, append the iteration prompt as a new user turn, and call `generateContent` with the full conversation. Save the updated conversation for potential further iteration.

### Auto-Iteration Rules

- **Max 3 auto-iterations** per generation request. After 3 attempts, show the best result to the user with notes on what's still off and suggest they either refine the prompt or start fresh.
- **One fix per iteration** when possible. Stacking multiple fixes in one prompt is fine for related issues (e.g., "fix the spelling of SUMMER and make it bolder"), but don't try to fix 5 unrelated things at once.
- **Tell the user what you're doing.** Before each auto-iteration, briefly note: "The generated image has [issue]. Iterating to fix..." Don't silently retry.
- **Track what you've tried.** If the same flaw persists after 2 iterations, it's likely a prompt-level issue, not something iteration can fix. Tell the user and suggest rephrasing the original prompt or using a different model.
- **Don't iterate on subjective preferences.** Auto-iteration is for objective flaws (misspellings, missing elements, artifacts). Subjective things like "I think the blue could be warmer" are suggestions for the user to decide on.

### Presenting Results to the User

After QC passes (or max iterations reached), present the image with structured commentary:

```
**Generated image:** [path to file]

**QC Notes:**
- Text accuracy: All text renders correctly ✓
- Composition: Headline is prominent in the upper third, subtitle sits below ✓
- Color: Warm gold palette matches the request ✓
- Minor: The bottom text is slightly smaller than expected — legible but could be more prominent

**Suggestions for next iteration:**
- The script font could be bolder for better readability at small sizes
- Consider adding more contrast between the background gradient and the lower text elements
```

This gives the user actionable next steps if they want to continue refining. If they ask for changes, use conversational iteration — load the conversation, append their instruction, regenerate, and QC again.

## When NOT to Use This Skill

- For **analyzing** or **describing** existing images (use Gemini's vision/text models instead)
- For **video generation** (not covered)
- For **image upscaling or super-resolution** (use specialized tools)
- When the user wants to use a **different image generation API** (DALL-E, Stable Diffusion, Midjourney)
