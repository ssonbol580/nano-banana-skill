#!/usr/bin/env npx tsx
/**
 * nano-banana generate.ts — Standalone Gemini image generation script.
 *
 * Usage:
 *   npx tsx generate.ts --prompt "A photorealistic coffee cup" --output output.png
 *   npx tsx generate.ts --prompt "Edit the text" --input reference.png --output edited.png
 *   npx tsx generate.ts --prompt "Make colors warmer" --conversation conv-001.json --output iterated.png
 *
 * Options:
 *   --prompt        Text prompt (required)
 *   --input         Reference image path (optional, for image-to-image)
 *   --output        Output image path (default: generated-<timestamp>.png)
 *   --model         Gemini model (default: gemini-3.1-flash-image-preview)
 *   --thinking      Thinking level for 3.1 Flash: minimal or high (default: high)
 *   --aspect-ratio  Image aspect ratio (default: 1:1)
 *   --size          Image size: 512, 1K, 2K, 4K (default: 2K)
 *   --conversation  Path to conversation JSON for multi-turn iteration
 *   --save-conv     Path to save conversation state (for future iteration)
 *   --timeout       Timeout in seconds (default: 60)
 *   --retries       Max retries (default: 3)
 */

import { config } from "dotenv";
config({ path: ".env.local" });  // Load project's env file first
config();                         // Fallback to .env

import { GoogleGenAI } from "@google/genai";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { parseArgs } from "util";

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    prompt:         { type: "string" },
    input:          { type: "string" },
    output:         { type: "string" },
    model:          { type: "string", default: "gemini-3.1-flash-image-preview" },
    thinking:       { type: "string", default: "high" },
    "aspect-ratio": { type: "string", default: "1:1" },
    size:           { type: "string", default: "2K" },
    conversation:   { type: "string" },
    "save-conv":    { type: "string" },
    timeout:        { type: "string", default: "60" },
    retries:        { type: "string", default: "3" },
  },
});

if (!args.prompt) {
  console.error("Error: --prompt is required");
  process.exit(1);
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Error: GEMINI_API_KEY environment variable not set");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Build request
// ---------------------------------------------------------------------------

const ai = new GoogleGenAI({ apiKey });
const model = args.model!;
const timeoutMs = parseInt(args.timeout!) * 1000;
const maxRetries = parseInt(args.retries!);

// Build config — NOTE: no temperature for image generation
const config: Record<string, unknown> = {
  responseModalities: ["TEXT", "IMAGE"],
  imageConfig: {
    aspectRatio: args["aspect-ratio"],
    imageSize: args.size,
  },
};

// Thinking config (for 3.x models — both 3.1 Flash and 3 Pro)
if (model === "gemini-3.1-flash-image-preview" || model === "gemini-3-pro-image-preview") {
  const level = args.thinking === "minimal" ? "Minimal" : "High";
  config.thinkingConfig = { thinkingLevel: level, includeThoughts: true };
}

// Build contents
let contents: Record<string, unknown>[];

if (args.conversation) {
  // Multi-turn iteration: load existing conversation and append
  const existing = JSON.parse(readFileSync(args.conversation, "utf-8"));
  contents = [
    ...existing,
    { role: "user", parts: [{ text: args.prompt }] },
  ];
} else {
  // Fresh generation (optionally with reference image)
  const parts: Record<string, unknown>[] = [];

  if (args.input) {
    const imageBuffer = readFileSync(args.input);
    const ext = args.input.split(".").pop()?.toLowerCase() ?? "png";
    const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
    parts.push({
      inlineData: { mimeType, data: imageBuffer.toString("base64") },
    });
  }

  parts.push({ text: args.prompt });
  contents = [{ role: "user", parts }];
}

// ---------------------------------------------------------------------------
// Generate with retry + timeout
// ---------------------------------------------------------------------------

async function generate() {
  let lastError: Error | null = null;
  const startTime = Date.now();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const apiCall = ai.models.generateContent({ model, contents, config });
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gemini request timed out")), timeoutMs)
      );
      const response = await Promise.race([apiCall, timeout]);

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      let imageBase64: string | null = null;
      let modelText = "";

      for (const part of parts as Record<string, unknown>[]) {
        if ("inlineData" in part && (part.inlineData as Record<string, unknown>)) {
          imageBase64 = (part.inlineData as Record<string, string>).data;
        }
        if ("text" in part && part.text && !(part as Record<string, unknown>).thought) {
          modelText += part.text;
        }
      }

      if (!imageBase64) {
        throw new Error("Gemini did not return an image." + (modelText ? ` Model said: ${modelText}` : ""));
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      // Save image
      const outputPath = args.output ?? `generated-${Date.now()}.png`;
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, Buffer.from(imageBase64, "base64"));

      // Save conversation state if requested
      if (args["save-conv"]) {
        const modelContent = response.candidates?.[0]?.content ?? { role: "model", parts: [] };
        const conversation = args.conversation
          ? [...contents, modelContent]
          : [contents[0], modelContent];
        mkdirSync(dirname(args["save-conv"]), { recursive: true });
        writeFileSync(args["save-conv"], JSON.stringify(conversation, null, 2));
        console.log(`Conversation saved: ${args["save-conv"]}`);
      }

      console.log(`Image saved: ${outputPath} (${elapsed}s, model: ${model})`);
      if (modelText) console.log(`Model text: ${modelText}`);
      return;
    } catch (e) {
      lastError = e as Error;
      const status = (e as { status?: number }).status;

      if (status === 503) {
        console.error("Model overloaded (503). Try a different model or try later.");
        process.exit(1);
      }

      if (attempt < maxRetries - 1) {
        const delay = 5000 * Math.pow(2, attempt);
        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  console.error(`Generation failed after ${maxRetries} attempts: ${lastError?.message}`);
  process.exit(1);
}

generate();
