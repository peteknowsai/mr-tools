#!/usr/bin/env bun
/**
 * generate_card_art - Generate themed card art with Replicate + Cloudflare Images
 *
 * Calls Replicate API directly to generate art, then uploads to Cloudflare Images.
 * Returns a production-ready Cloudflare Image Delivery URL.
 *
 * Usage:
 *   generate_card_art "sailboat at sunset" --theme welcome
 *   generate_card_art "weather forecast sunny day" --theme weather --json
 *   generate_card_art "marina scene"  # Uses default watercolor style
 *
 * Themes:
 *   welcome      - Warm, inviting welcome cards (watercolor style)
 *   maintenance  - Clean, technical maintenance tips (geometric style)
 *   scenic       - Atmospheric scenic views (painted-scenic style)
 *   weather      - Weather conditions (painted-scenic style)
 *   navigation   - Technical navigation content (geometric-bold style)
 *   community    - Social, lifestyle community content (flat-illustration style)
 *
 * Returns: Cloudflare Image Delivery URL (https://imagedelivery.net/.../public)
 *
 * Environment variables:
 *   REPLICATE_API_TOKEN - Replicate API key
 *   CLOUDFLARE_ACCOUNT_ID - Cloudflare account ID
 *   CLOUDFLARE_IMAGES_TOKEN - Cloudflare API token with Images write permission
 */

import Replicate from "replicate";
import { getSecret } from "../../lib/config";

const MODEL = "google/nano-banana:1b7b945e8f7edf7a034eba6cb2c20f2ab5dc7d090eea1c616e96da947be76aee";
const ASPECT_RATIO = "16:9";
const OUTPUT_FORMAT = "jpg";

// Style descriptions for consistent illustration aesthetic
const STYLE_DESCRIPTIONS = {
  watercolor: 'illustrated in a soft watercolor style, warm and inviting, magazine quality illustration, painterly',
  geometric: 'illustrated in a clean geometric style, modern minimalist illustration, bold shapes, magazine quality',
  'flat-illustration': 'illustrated in a flat illustration style, vibrant colors, contemporary magazine illustration',
  'geometric-bold': 'illustrated in a bold geometric style, strong shapes and lines, modern technical illustration, magazine quality',
  'painted-scenic': 'illustrated in a painterly scenic style, atmospheric and artistic, magazine quality painted illustration',
} as const;

type StyleRef = keyof typeof STYLE_DESCRIPTIONS;

// Theme to style mapping
const THEME_STYLES: Record<string, StyleRef> = {
  welcome: 'watercolor',
  maintenance: 'geometric',
  scenic: 'painted-scenic',
  weather: 'painted-scenic',
  navigation: 'geometric-bold',
  community: 'flat-illustration',
};

const DEFAULT_STYLE: StyleRef = 'watercolor';

function getReplicateKey(): string | undefined {
  return getSecret({ tool: "replicate", key: "api_key", env: ["REPLICATE_API_TOKEN", "REPLICATE_API_KEY"] });
}

function getCloudflareAccountId(): string | undefined {
  return getSecret({ tool: "cloudflare", key: "account_id", env: ["CLOUDFLARE_ACCOUNT_ID"] });
}

function getCloudflareImagesToken(): string | undefined {
  return getSecret({ tool: "cloudflare", key: "images_token", env: ["CLOUDFLARE_IMAGES_TOKEN", "CLOUDFLARE_API_TOKEN"] });
}

function getStyleForTheme(theme?: string): { styleRef: StyleRef; description: string } {
  const styleRef = theme ? THEME_STYLES[theme] || DEFAULT_STYLE : DEFAULT_STYLE;
  return { styleRef, description: STYLE_DESCRIPTIONS[styleRef] };
}

async function uploadToCloudflareImages(imageUrl: string, accountId: string, apiToken: string): Promise<string> {
  // Download image from Replicate
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image from Replicate: ${imageResponse.statusText}`);
  }

  const imageBlob = await imageResponse.blob();
  const imageBuffer = await imageBlob.arrayBuffer();

  // Upload to Cloudflare Images
  const formData = new FormData();
  formData.append('file', new Blob([imageBuffer], { type: 'image/jpeg' }), 'card.jpg');

  const uploadResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
      body: formData,
    }
  );

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Cloudflare Images upload failed (${uploadResponse.status}): ${errorText}`);
  }

  const uploadData = await uploadResponse.json();

  if (!uploadData.success || !uploadData.result?.variants?.[0]) {
    throw new Error('No image URL in Cloudflare Images response');
  }

  // Return the public variant URL
  return uploadData.result.variants[0];
}

// Parse arguments
const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");

// Extract theme if provided
let theme: string | undefined;
const themeIndex = args.indexOf("--theme");
if (themeIndex !== -1 && args[themeIndex + 1]) {
  theme = args[themeIndex + 1];
}

// Get prompt (filter out flags)
const prompt = args
  .filter((a, i) => {
    if (a === "--json") return false;
    if (a === "--theme") return false;
    if (i > 0 && args[i - 1] === "--theme") return false;
    return true;
  })
  .join(" ");

if (!prompt) {
  console.error("Error: Prompt required");
  console.error("\nUsage:");
  console.error("  generate_card_art \"sailboat at sunset\" --theme welcome");
  console.error("  generate_card_art \"marina scene\" --json");
  console.error("\nThemes:");
  console.error("  welcome      - Warm, inviting (watercolor)");
  console.error("  maintenance  - Technical (geometric)");
  console.error("  scenic       - Atmospheric views (painted-scenic)");
  console.error("  weather      - Weather conditions (painted-scenic)");
  console.error("  navigation   - Navigation content (geometric-bold)");
  console.error("  community    - Social/lifestyle (flat-illustration)");
  console.error("\nEnvironment variables:");
  console.error("  REPLICATE_API_TOKEN - Replicate API key");
  console.error("  CLOUDFLARE_ACCOUNT_ID - Cloudflare account ID");
  console.error("  CLOUDFLARE_IMAGES_TOKEN - Cloudflare API token");
  process.exit(1);
}

// Validate credentials
const replicateKey = getReplicateKey();
if (!replicateKey) {
  console.error("Error: Missing Replicate API key. Set REPLICATE_API_TOKEN");
  process.exit(1);
}

const accountId = getCloudflareAccountId();
if (!accountId) {
  console.error("Error: Missing Cloudflare account ID. Set CLOUDFLARE_ACCOUNT_ID");
  process.exit(1);
}

const imagesToken = getCloudflareImagesToken();
if (!imagesToken) {
  console.error("Error: Missing Cloudflare Images token. Set CLOUDFLARE_IMAGES_TOKEN");
  process.exit(1);
}

try {
  // Get style description for theme
  const { styleRef, description: styleDescription } = getStyleForTheme(theme);

  // Combine user prompt with style description and explicit no-text instructions
  const fullPrompt = `${prompt}, ${styleDescription}, no text, no labels, no titles, no words, no copy, illustration only`;

  // Generate with Replicate
  const replicate = new Replicate({ auth: replicateKey });

  const output = await replicate.run(MODEL as any, {
    input: {
      prompt: fullPrompt,
      aspect_ratio: ASPECT_RATIO,
      output_format: OUTPUT_FORMAT,
    },
  });

  // Extract URL from Replicate output
  let replicateUrl: string;
  if (Array.isArray(output)) {
    const firstOutput = output[0];
    if (typeof firstOutput === 'object' && 'url' in firstOutput) {
      const urlObj = await firstOutput.url();
      replicateUrl = String(urlObj);
    } else {
      replicateUrl = String(firstOutput);
    }
  } else if (typeof output === 'object' && output !== null && 'url' in output) {
    const urlObj = await (output as any).url();
    replicateUrl = String(urlObj);
  } else {
    replicateUrl = String(output);
  }

  if (!replicateUrl) {
    throw new Error("No image URL returned from Replicate");
  }

  // Upload to Cloudflare Images and get delivery URL
  const deliveryUrl = await uploadToCloudflareImages(replicateUrl, accountId, imagesToken);

  if (jsonOutput) {
    console.log(JSON.stringify({
      url: deliveryUrl,
      prompt,
      theme: theme || 'default',
      styleReference: styleRef,
      model: MODEL,
      aspectRatio: ASPECT_RATIO,
      format: OUTPUT_FORMAT,
      timestamp: new Date().toISOString(),
    }, null, 2));
  } else {
    // Output only the URL for easy consumption by Agent Team
    console.log(deliveryUrl);
  }

  process.exit(0);
} catch (error) {
  if (jsonOutput) {
    console.error(JSON.stringify({
      error: "Failed to generate card art",
      message: error instanceof Error ? error.message : String(error),
    }, null, 2));
  } else {
    console.error("Error:", error instanceof Error ? error.message : String(error));
  }
  process.exit(1);
}
