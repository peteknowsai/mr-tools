#!/usr/bin/env bun
/**
 * replicate_generate_boat - Generate boat variations with Nano Banana
 *
 * Workflow tool for Agent Team: Generate artistic variations of user's
 * boat photo for daily compositions.
 *
 * Usage:
 *   replicate_generate_boat /path/to/boat.png "boat at sunset in tropical waters"
 *   replicate_generate_boat boat.jpg "boat docked at marina" --json
 *
 * Preset Configuration:
 *   Model: google/nano-banana (Gemini 2.5 Flash)
 *   Aspect Ratio: 1:1 square
 *   Format: JPEG
 *   Mode: Image-to-image (takes user's boat photo as base)
 *
 * Returns: Replicate CDN URL ready for boat card imageUrl field
 */

import Replicate from "replicate";
import { getSecret } from "../../lib/config";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

const MODEL = "google/nano-banana";
const ASPECT_RATIO = "1:1";
const OUTPUT_FORMAT = "jpg";

function getApiKey(): string | undefined {
  return getSecret({ tool: "replicate", key: "api_key", env: ["REPLICATE_API_TOKEN", "REPLICATE_API_KEY"] });
}

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const filteredArgs = args.filter(a => a !== "--json");

if (filteredArgs.length < 2) {
  console.error("Error: Image path and prompt required");
  console.error("\nUsage:");
  console.error("  replicate_generate_boat /path/to/boat.png \"boat at sunset\"");
  console.error("  replicate_generate_boat boat.jpg \"boat at marina\" --json");
  process.exit(1);
}

const imagePath = filteredArgs[0];
const prompt = filteredArgs.slice(1).join(" ");

if (!existsSync(imagePath)) {
  console.error(`Error: Image file not found: ${imagePath}`);
  process.exit(1);
}

try {
  const key = getApiKey();
  if (!key) {
    throw new Error("Missing Replicate API key. Run: replicate config set api-key <key>");
  }

  const replicate = new Replicate({ auth: key });

  // Read the boat image file
  const imageBuffer = await readFile(imagePath);

  // Generate boat variation with preset configuration
  const output = await replicate.run(MODEL as any, {
    input: {
      prompt,
      image_input: [imageBuffer],
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
      inputImage: imagePath,
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
      error: "Failed to generate boat variation",
      message: error instanceof Error ? error.message : String(error),
    }, null, 2));
  } else {
    console.error("Error:", error instanceof Error ? error.message : String(error));
  }
  process.exit(1);
}
