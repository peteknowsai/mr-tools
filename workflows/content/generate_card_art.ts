#!/usr/bin/env bun
/**
 * generate_card_art - Generate card art and store it
 *
 * Simple workflow tool for Agent Team: Generate card art from a text prompt.
 * Returns a path to the stored image ready to use in card compositions.
 *
 * Usage:
 *   generate_card_art "sailboat at sunset in tropical waters"
 *   generate_card_art "weather forecast sunny day" --json
 *
 * Returns: Image path for use in cards (e.g., "/r2/images/generated/card_abc123.jpg")
 */

// Smart environment detection: defaults to localhost for dev, can be overridden
const API_BASE_URL =
  process.env.API_BASE_URL ||                                    // Explicit override
  (process.env.ENVIRONMENT === "production"
    ? "https://captain32-api.peteknowsai.workers.dev"           // Production
    : "http://localhost:8787");                                  // Development default

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "dev-secret-key";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const prompt = args.filter(a => a !== "--json").join(" ");

if (!prompt) {
  console.error("Error: Prompt required");
  console.error("\nUsage:");
  console.error("  generate_card_art \"sailboat at sunset\"");
  console.error("  generate_card_art \"marina scene\" --json");
  process.exit(1);
}

try {
  const response = await fetch(`${API_BASE_URL}/internal/generate-card-art`, {
    method: "POST",
    headers: {
      "X-Internal-Secret": INTERNAL_SECRET,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (jsonOutput) {
    console.log(JSON.stringify({
      path: data.path,
      prompt,
      timestamp: new Date().toISOString(),
    }, null, 2));
  } else {
    console.log(data.path);
  }

  process.exit(0);
} catch (error) {
  if (jsonOutput) {
    console.log(JSON.stringify({
      error: "Failed to generate card art",
      message: error instanceof Error ? error.message : String(error),
    }, null, 2));
  } else {
    console.error("Error:", error instanceof Error ? error.message : String(error));
  }
  process.exit(1);
}
