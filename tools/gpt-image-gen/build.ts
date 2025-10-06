#!/usr/bin/env bun

import { $ } from "bun";
import { existsSync, mkdirSync } from "fs";

const platforms = [
  { target: "bun-darwin-arm64", name: "gpt-image-gen-mac-arm64" },
  { target: "bun-darwin-x64", name: "gpt-image-gen-mac-x64" },
  { target: "bun-linux-x64", name: "gpt-image-gen-linux-x64" },
  { target: "bun-linux-arm64", name: "gpt-image-gen-linux-arm64" },
  // Note: Windows support in Bun is experimental
  // { target: "bun-windows-x64", name: "gpt-image-gen-windows.exe" }
];

async function build() {
  console.log("🔨 Building GPT-Image-Gen CLI for multiple platforms...\n");

  // Create dist directory
  if (!existsSync("dist")) {
    mkdirSync("dist");
  }

  // Build for current platform (optimized)
  console.log("Building for current platform...");
  try {
    await $`bun build --compile --minify ./src/cli.ts --outfile gpt-image-gen`;
    console.log("✅ Built: ./gpt-image-gen (current platform)\n");
  } catch (error) {
    console.error("❌ Failed to build for current platform:", error);
  }

  // Build for all platforms
  for (const platform of platforms) {
    console.log(`Building for ${platform.target}...`);
    try {
      await $`bun build --compile --target=${platform.target} ./src/cli.ts --outfile dist/${platform.name}`;
      console.log(`✅ Built: dist/${platform.name}`);
    } catch (error) {
      console.error(`❌ Failed to build for ${platform.target}:`, error);
    }
  }

  console.log("\n✨ Build complete!");
  console.log("\nBinaries available in:");
  console.log("  ./gpt-image-gen (current platform, optimized)");
  console.log("  ./dist/ (all platforms)");
}

// Run build if executed directly
if (import.meta.main) {
  build().catch(console.error);
}