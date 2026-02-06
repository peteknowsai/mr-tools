#!/usr/bin/env bun
import { z } from "zod";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

// Minimal validation for ConversationItem
const ConversationItemSchema = z.object({
  type: z.enum([
    "text",
    "image_card",
    "text_input",
    "survey",
    "multi_select_survey",
    "image_upload",
  ], {
    errorMap: () => ({ message: 'Type must be one of: text, image_card, text_input, survey, multi_select_survey, image_upload' }),
  }),
}).passthrough(); // Allow additional fields beyond type

type ConversationItem = z.infer<typeof ConversationItemSchema>;

// Storage
const CARDS_DIR = "/tmp/captain32-cards";
const ASSEMBLY_FILE = join(CARDS_DIR, "assembly.json");

async function readStdin(): Promise<string> {
  const chunks: string[] = [];

  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(Buffer.from(chunk).toString());
  }

  return chunks.join("");
}

async function addItem(itemJson: string): Promise<void> {
  // Parse JSON
  let itemData: unknown;
  try {
    itemData = JSON.parse(itemJson);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Validate with Zod
  const result = ConversationItemSchema.safeParse(itemData);

  if (!result.success) {
    // Handle Bun-compiled binary error structure
    const zodError = result.error;
    let errorMessages: string;

    if (zodError.errors && Array.isArray(zodError.errors)) {
      errorMessages = zodError.errors
        .map(err => `  - ${err.path.join('.')}: ${err.message}`)
        .join('\n');
    } else if (zodError.message) {
      try {
        const parsedErrors = JSON.parse(zodError.message);
        if (Array.isArray(parsedErrors)) {
          errorMessages = parsedErrors
            .map(err => `  - ${err.path.join('.')}: ${err.message}`)
            .join('\n');
        } else {
          errorMessages = zodError.message;
        }
      } catch {
        errorMessages = zodError.message;
      }
    } else {
      errorMessages = JSON.stringify(result);
    }

    throw new Error(`Validation failed:\n${errorMessages}`);
  }

  const item: ConversationItem = result.data;

  // Ensure storage directory exists
  await mkdir(CARDS_DIR, { recursive: true });

  // Read existing assembly or create new structure
  let assembly: { items: ConversationItem[] } = { items: [] };
  try {
    const existingData = await readFile(ASSEMBLY_FILE, 'utf-8');
    const parsed = JSON.parse(existingData);
    if (parsed && Array.isArray(parsed.items)) {
      assembly = parsed;
    }
  } catch (error) {
    // File doesn't exist or is invalid, start fresh
    assembly = { items: [] };
  }

  // Append new item
  assembly.items.push(item);

  // Write back to file
  await writeFile(ASSEMBLY_FILE, JSON.stringify(assembly, null, 2));

  // Output success message
  const itemCount = assembly.items.length;
  console.log(`✅ Added item: ${item.type}`);
  console.log(`📁 ${ASSEMBLY_FILE} (item ${itemCount} of N)`);
}

async function main() {
  try {
    const input = await readStdin();

    if (!input.trim()) {
      console.error("❌ Error: No input provided. Pipe ConversationItem JSON to stdin.");
      console.error("\nUsage:");
      console.error("  add_item <<'EOF'");
      console.error('  {"type": "text", "content": "Good morning, Captain Pete!"}');
      console.error("  EOF");
      process.exit(1);
    }

    await addItem(input);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

main();
