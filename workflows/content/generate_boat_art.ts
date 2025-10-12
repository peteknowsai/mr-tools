#!/usr/bin/env bun
/**
 * generate_boat_art - Generate boat art variations and store it
 *
 * Simple workflow tool for Agent Team: Generate boat art from user's boat photo.
 * Returns a path to the stored image ready to use in card compositions.
 *
 * Usage:
 *   generate_boat_art <userId> <boatImageUrl> "boat at sunset"
 *   generate_boat_art user123 http://localhost:8787/r2/uploads/boats/user123/boat.jpg "stormy seas" --json
 *
 * Returns: Image path for use in cards (e.g., "/r2/generated/boats/user123/123_abc.jpg")
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
const filteredArgs = args.filter(a => a !== "--json");

if (filteredArgs.length < 3) {
  console.error("Error: userId, boat image URL, and prompt required");
  console.error("\nUsage:");
  console.error("  generate_boat_art <userId> <boatImageUrl> \"boat at sunset\"");
  console.error("  generate_boat_art user123 http://localhost:8787/r2/uploads/boats/user123/boat.jpg \"stormy seas\" --json");
  process.exit(1);
}

const userId = filteredArgs[0];
const boatImageUrl = filteredArgs[1];
const prompt = filteredArgs.slice(2).join(" ");

try {
  const response = await fetch(`${API_BASE_URL}/internal/generate-boat-art`, {
    method: "POST",
    headers: {
      "X-Internal-Secret": INTERNAL_SECRET,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, boatImageUrl, prompt }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (jsonOutput) {
    console.log(JSON.stringify({
      path: data.path,
      boatImageUrl,
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
      error: "Failed to generate boat art",
      message: error instanceof Error ? error.message : String(error),
    }, null, 2));
  } else {
    console.error("Error:", error instanceof Error ? error.message : String(error));
  }
  process.exit(1);
}
