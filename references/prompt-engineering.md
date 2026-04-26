# Prompt Engineering for Gemini Image Generation

This reference contains hard-won knowledge from 45+ iterations of Gemini image generation. These patterns apply to any image generation task, not just product labels.

## Table of Contents
1. [How AI Text Rendering Works](#how-ai-text-rendering-works)
2. [Typography Translation Table](#typography-translation-table)
3. [Size & Scale Vocabulary](#size--scale-vocabulary)
4. [Spatial Anchoring](#spatial-anchoring)
5. [Color & Palette](#color--palette)
6. [Negative Guidance](#negative-guidance)
7. [Prompt Structure](#prompt-structure)
8. [Common Pitfalls](#common-pitfalls)
9. [Iteration Strategy](#iteration-strategy)
10. [The 90/10 Rule](#the-9010-rule)

---

## How AI Text Rendering Works

Gemini's image model "paints" text — it does not have access to font files, point sizes, or typographic metrics. This has profound implications:

- **Describe typography with adjectives**, never font names. The model doesn't know what "Helvetica" looks like — it knows what "clean, modern, bold sans-serif" looks like.
- **Describe sizes with spatial language**, never pixels or points. The model doesn't understand "24px" — it understands "spanning the full width."
- **Emphasis is visual, not semantic.** Making text "bold" means describing it as "heavy, thick letterforms" — not using markdown or HTML bold.
- **Text rendering is the hardest part.** Expect misspellings and layout drift, especially with longer text. Keep text short and specific.

## Typography Translation Table

| You're Thinking Of | Describe It As |
|---|---|
| Helvetica / Arial / Inter | "clean, modern, bold sans-serif typography" |
| Times New Roman / Garamond | "elegant, classic serif typography with high contrast strokes" |
| Impact / Varsity / Block | "heavy, blocky, condensed collegiate lettering" |
| Futura / Avenir / Geometric | "minimalist, geometric, futuristic sans-serif font" |
| Copperplate / Engraved | "delicate, thin copperplate calligraphy" |
| Graffiti / Street Art | "messy, marker-drawn graffiti tag" |
| High Fashion / Vogue | "ultra-thin, minimalist, tracked-out sans-serif font" |
| Playful / Rounded | "chunky, rounded, friendly bubble letters" |
| Typewriter / Mono | "typewriter-style monospaced font" |
| Handwritten / Script | "flowing, natural handwritten script" |
| Y2K / Futuristic | "chunky, stretched, futuristic Y2K typography" |
| Signature / Autograph | "sophisticated, sweeping signature script" |

**Important:** Cursive and handwritten fonts render inconsistently. Prefer clean sans-serif variants for reliable results. Only use cursive when specifically requested.

## Size & Scale Vocabulary

Never use pixel values, point sizes, or percentages. Use spatial language:

### Large / Hero
- "prominent"
- "spanning the full width"
- "edge-to-edge"
- "occupying the top third"
- "dominant, eye-catching"

### Medium / Balanced
- "centered"
- "clearly visible"
- "proportional"
- "well-balanced"

### Small / Secondary
- "subtle"
- "understated"
- "compact"
- "tucked away"
- "minimalist"

### Tiny / Fine Print
- "micro-typography"
- "fine print"
- "barely legible"
- "small footer text"

### Danger Words
- **"massive" / "oversized"** — causes elements to overflow and bleed off edges. Use "prominent, spanning" instead.
- **"huge"** — unpredictable scaling. Use "dominant, occupying [fraction] of the [area]."
- **"tiny"** — may become illegible. Use "subtle, clearly legible small text."

## Spatial Anchoring

Position elements using relative spatial language, not absolute coordinates:

### Good Anchoring
- "Occupying the top third of the image"
- "A thick rectangular bar cutting across the entire width of the lower half"
- "Spanning the full vertical height of the left edge"
- "Centered in the middle third, flanked by equal whitespace"
- "Tucked into the bottom-right corner"
- "A narrow strip running along the very bottom edge"

### Bad Anchoring
- "At the top" (too vague — how far from the edge?)
- "On the left side" (how wide? how tall?)
- "Below the title" (relative to what if there's no prior context?)
- "At position (100, 200)" (meaningless to the model)

### Describing Zones
When an image has multiple text or design zones, describe them top-to-bottom (or in natural reading order). Mention how zones relate to each other: "Below the headline, separated by a thin rule..."

## Color & Palette

### Be Specific
| Don't Say | Say Instead |
|---|---|
| "yellow" | "warm honey gold" or "bright lemon yellow" or "muted mustard" |
| "blue" | "deep ocean blue" or "powder blue" or "electric cobalt" |
| "green" | "deep forest green" or "bright lime" or "sage green" |
| "red" | "crimson" or "warm terracotta" or "neon cherry red" |

### Color Harmony
When an image has multiple colored elements, ensure they form a coherent palette. Describe the palette direction:
- "warm earth tones throughout"
- "cool ocean blues and silvers"
- "high contrast: matte black with gold accents"
- "monochromatic: various shades of deep purple"

### Dark Backgrounds
When using dark backgrounds, explicitly describe contrast:
- "white text on matte black background"
- "golden lettering that pops against the dark surface"
- If there's a translucent or transparent element over a dark label, describe how it should look: "the orange liquid visible through clear glass, contrasting against the dark label"

## Negative Guidance

Always append what NOT to include at the end of your prompt. This dramatically reduces common artifacts.

### Template
```
Do NOT include: [list of things to exclude].
```

### Common Exclusions
- "distorted or misspelled text"
- "blurry or out-of-focus regions"
- "extra floating elements"
- "watermarks or signatures"
- "text not specified in the prompt"
- "multiple copies of the subject"
- "messy or cluttered backgrounds"
- "extra shadows or reflections that weren't described"

### Task-Specific Exclusions
For product photography: "wrinkled labels, text bleeding off the edge, extra bottles"
For portraits: "extra fingers, distorted features, asymmetric eyes"
For landscapes: "text overlays, watermarks, unnatural color banding"

Tailor your negative guidance to the specific type of image you're generating.

## Prompt Structure

A well-structured prompt follows this general pattern:

```
[Subject description — what is the main thing in the image]

[Style/aesthetic — photorealistic? illustrated? watercolor? flat design?]

[Composition — how elements are arranged in the frame]

[Details — specific elements, text, colors, typography]

[Lighting/atmosphere — mood, time of day, lighting direction]

[Negative guidance — what to exclude]
```

### For Images with Text
When generating images that contain text (labels, posters, signs, UI mockups):

1. **State each text element explicitly** with its exact content in quotes
2. **Describe the typography** for each text element (style, weight, color)
3. **Anchor each element spatially** (where it goes in the composition)
4. **Describe emphasis** both in the text content AND the style (dual description rule)

Example:
```
A modern poster design on white background.

At the top, in heavy, blocky sans-serif lettering colored deep navy, the text reads "SUMMER FEST 2025".

Below, in elegant thin serif typography colored warm gold, the text reads "July 15-17 | Central Park".

At the bottom, in subtle small sans-serif colored medium gray, the text reads "Tickets at summerfest.com". The word "summerfest.com" is slightly bolder than the rest.

Do NOT include: misspelled text, extra decorative elements not described, watermarks.
```

## Common Pitfalls

These are battle-tested rules from extensive iteration:

### 1. Emphasis Requires Dual Description
To make specific text stand out (like making "FREE" bold within a line), you must describe it in BOTH places:
- In the **text content**: `"Free Shipping · NO MINIMUM · Easy Returns"` 
- In the **style description**: `"clean sans-serif with NO MINIMUM in bold uppercase, larger than surrounding text"`

Just putting it in caps in the text content is not enough.

### 2. Too Many Typography Styles Creates Chaos
Keep to **2-3 distinct typography styles** per image. Mixing serif, sans-serif, cursive, and graffiti in one composition creates visual noise. Pick a primary and a secondary style, with optional accent.

### 3. Cursive Renders Inconsistently  
Handwritten/cursive/script fonts are the least reliable to generate. Letters merge, spacing is uneven, and readability suffers. Default to clean sans-serif and only use cursive when the user specifically asks for it.

### 4. "Massive" Overflows
The words "massive," "oversized," and "huge" cause elements to bleed off the edge of the image. Use "prominent, spanning the [specific dimension]" for large elements. Be specific about what they span.

### 5. Unwanted Icons/Logos
If you describe a "logo" or "icon" or "emblem" in the prompt, the model WILL generate one — even if it's ugly. If you don't want graphical elements, explicitly say "no icon, no emblem, no graphic — text only" in that region of the prompt.

### 6. Long Text Misspells
The longer a text string, the more likely it will contain misspellings or dropped characters. Keep text elements short. If you need a long sentence, consider breaking it into multiple spatially-separated elements.

### 7. Color Drift in Iteration
After several iteration turns, colors can drift from the original. If color accuracy matters, re-state the specific colors in your iteration instruction: "Keep the background deep navy (#1a1a2e) and make the text warm gold."

## Common QC Failures & Fix Prompts

When the Design Critic Loop catches a flaw, here are proven iteration prompts for the most common issues. These are drawn from 45+ iterations of real generation work.

### Misspelled Text
The most common failure. Gemini "paints" text and frequently drops, swaps, or duplicates characters in longer words.

| What You See | Iteration Prompt |
|---|---|
| "SUMEMR FEST" instead of "SUMMER FEST" | "The word 'SUMMER' is misspelled as 'SUMEMR'. Fix the spelling to read 'SUMMER FEST'. Keep everything else identical." |
| Missing word — "Tickets at" with no URL | "The text 'sunsetbeats.com' is missing from the bottom line. Add 'sunsetbeats.com' after 'Tickets at' in the same style." |
| Phantom text — extra words that weren't requested | "Remove the text '[phantom text]' that appears in the [location]. It was not part of the original request." |

### Layout / Positioning Issues
Elements in wrong positions or wrong relative sizes.

| What You See | Iteration Prompt |
|---|---|
| Headline is too small, gets lost | "Make the headline text more prominent — increase the size so it spans roughly two-thirds of the width and dominates the visual hierarchy." |
| Element in wrong zone | "Move the tagline from the center to just below the headline, with a small gap separating them." |
| Elements overlapping | "The subtitle text is overlapping with the flavor bar. Add more vertical spacing between them so both are clearly legible." |

### Color Issues

| What You See | Iteration Prompt |
|---|---|
| Wrong color on an element | "Change the headline color from white to warm brushed gold. Keep the font style and size the same." |
| Low contrast / illegible text | "The white text is barely visible against the light background. Add a subtle dark drop shadow behind the text for contrast." |
| Palette doesn't match | "Shift the overall palette warmer — the blues should be more amber/golden and the grays should be warm cream tones." |

### Artifacts & Glitches

| What You See | Iteration Prompt |
|---|---|
| Floating disconnected element | "Remove the floating [shape/element] in the [upper right / lower left / etc]. It shouldn't be there." |
| Smudged region | "There's a smudged/blurry area near the [location]. Clean it up so the region is crisp and matches the surrounding area." |
| Element bleeding off edge | "The [element] is cut off at the [edge]. Pull it inward so it has breathing room and doesn't bleed off the edge." |

### When to Give Up on Iteration

These issues are usually NOT fixable via iteration — regenerate fresh instead:
- Text that keeps misspelling after 2 attempts (rephrase the prompt or shorten the text)
- Fundamental composition that doesn't match the request (the model interpreted the prompt differently)
- Style that's completely wrong (e.g., asked for photorealistic, got illustrated)
- After 4-5 conversation turns — artifacts accumulate, start fresh

## Iteration Strategy

### When to Iterate (Multi-turn) vs. Regenerate (Fresh)
- **Iterate** when: refining colors, adjusting sizes, moving elements slightly, changing single text elements, trying "more of this / less of that"
- **Regenerate** when: completely changing style direction, switching from portrait to landscape, fundamentally different composition, the conversation has accumulated too many turns (4-5+)

### Good Iteration Instructions
Keep them short. Gemini has the full conversation context — it knows what it generated.

**Good:**
- "Make the headline text larger and change it to deep red"
- "Move the subtitle up closer to the main title"
- "Make the overall palette warmer — more golden tones"
- "Remove the decorative border and add more whitespace"

**Bad (too long, re-describes everything):**
- "Generate the same image but this time make sure the headline text which says SUMMER FEST 2025 in the heavy blocky sans-serif is larger and colored in deep red instead of the navy blue, and keep everything else the same including the subtitle and the footer text and the white background"

The model already knows what the headline says and what style it's in. Just tell it what to change.

### Forking Strategy
When exploring variations of a design that's working:
1. **Fork** the conversation (deep-clone the conversation JSON)
2. Give each fork a different direction: "warmer colors," "bolder typography," "more minimal"
3. Each fork is independent — changes in one don't affect others
4. Pick the winner and continue iterating from there

This is more efficient than starting from scratch each time because each fork preserves the base composition that's already working.

## The 90/10 Rule

AI image generation gets from 0% to 90% instantly — the overall composition, color palette, layout, and mood are usually good on the first few tries.

The last 10% — exact kerning, specific hex colors, pixel-perfect alignment, consistent font weights — is often faster to achieve in a real image editor (Figma, Photoshop, Canva) than through prompt iteration.

Focus your prompt engineering effort on:
- Getting the **creative direction** right (style, mood, palette)
- Getting the **layout structure** right (where elements go, relative sizes)
- Getting **text content** correct (exact words, spelling)

Don't fight the model for pixel-perfect precision. Get the direction right, then finish in an editor if precision matters.
