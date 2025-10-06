#!/usr/bin/env bun
/**
 * replicate_generate_card_art - Generate card art with Nano Banana
 *
 * Workflow tool for Agent Team: Generate custom 16:9 card art
 * with preset configurations optimized for Captain32 cards.
 *
 * Usage:
 *   replicate_generate_card_art "sailboat at sunset in tropical waters"
 *   replicate_generate_card_art "weather forecast sunny day" --json
 *
 * Preset Configuration:
 *   Model: google/nano-banana (Gemini 2.5 Flash)
 *   Aspect Ratio: 16:9 landscape
 *   Format: JPEG
 *
 * Returns: Replicate CDN URL ready for card imageUrl field
 */

import Replicate from "replicate";
import { getSecret } from "../../lib/config";

const MODEL = "google/nano-banana";
const ASPECT_RATIO = "16:9";
const OUTPUT_FORMAT = "jpg";

function getApiKey(): string | undefined {
  return getSecret({ tool: "replicate", key: "api_key", env: ["REPLICATE_API_TOKEN", "REPLICATE_API_KEY"] });
}

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const prompt = args.filter(a => a !== "--json").join(" ");

if (!prompt) {
  console.error("Error: Prompt required");
  console.error("\nUsage:");
  console.error("  replicate_generate_card_art \"sailboat at sunset\"");
  console.error("  replicate_generate_card_art \"marina scene\" --json");
  process.exit(1);
}

try {
  const key = getApiKey();
  if (!key) {
    throw new Error("Missing Replicate API key. Run: replicate config set api-key <key>");
  }

  const replicate = new Replicate({ auth: key });

  // Generate card art with preset configuration
  const output = await replicate.run(MODEL as any, {
    input: {
      prompt,
      aspect_ratio: ASPECT_RATIO,
      output_format: OUTPUT_FORMAT,
    },
  });

  // Extract URL from output (Nano Banana returns FileOutput object)
  let imageUrl: string;
  if (Array.isArray(output)) {
    // If array, get first item
    const firstOutput = output[0];
    if (typeof firstOutput === 'object' && 'url' in firstOutput) {
      const urlObj = await firstOutput.url();
      imageUrl = String(urlObj);
    } else {
      imageUrl = String(firstOutput);
    }
  } else if (typeof output === 'object' && output !== null && 'url' in output) {
    // If FileOutput object, call .url() method and convert to string
    const urlObj = await (output as any).url();
    imageUrl = String(urlObj);
  } else {
    imageUrl = String(output);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({
      url: imageUrl,
      prompt,
      model: MODEL,
      aspectRatio: ASPECT_RATIO,
      format: OUTPUT_FORMAT,
      timestamp: new Date().toISOString(),
    }, null, 2));
  } else {
    console.log(imageUrl);
  }

  process.exit(0);
} catch (error) {
  if (jsonOutput) {
    console.log(JSON.stringify({
      error: "Failed to generate art",
      message: error instanceof Error ? error.message : String(error),
    }, null, 2));
  } else {
    console.error("Error:", error instanceof Error ? error.message : String(error));
  }
  process.exit(1);
}
