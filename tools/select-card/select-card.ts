#!/usr/bin/env bun
import { z } from "zod";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

// Selection schema
const SelectionSchema = z.object({
  card_id: z.string().min(1, "Card ID is required"),
  rationale: z.string().min(1, "Rationale is required"),
});

type Selection = z.infer<typeof SelectionSchema>;

// Storage
const CARDS_DIR = "/tmp/captain32-cards";
const SELECTIONS_FILE = join(CARDS_DIR, "selections.json");

async function selectCard(cardId: string, rationale: string): Promise<void> {
  // Validate inputs
  const result = SelectionSchema.safeParse({ card_id: cardId, rationale });

  if (!result.success) {
    if (!result.error || !result.error.errors) {
      throw new Error(`Validation failed: ${JSON.stringify(result)}`);
    }
    const errors = result.error.errors
      .map(err => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`Validation failed:\n${errors}`);
  }

  const selection: Selection = result.data;

  // Ensure storage directory exists
  await mkdir(CARDS_DIR, { recursive: true });

  // Read existing selections or create new array
  let selections: Selection[] = [];
  try {
    const existingData = await readFile(SELECTIONS_FILE, 'utf-8');
    const parsed = JSON.parse(existingData);
    if (Array.isArray(parsed)) {
      selections = parsed;
    }
  } catch (error) {
    // File doesn't exist or is invalid, start fresh
    selections = [];
  }

  // Append new selection
  selections.push(selection);

  // Write back to file
  await writeFile(SELECTIONS_FILE, JSON.stringify(selections, null, 2));

  // Output success message
  console.log(`✅ Selected: ${selection.card_id}`);
  console.log(`📝 Rationale: ${selection.rationale}`);
  console.log(`📁 ${SELECTIONS_FILE}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("❌ Error: Missing required arguments");
    console.error("\nUsage:");
    console.error('  select_card <card_id> <rationale>');
    console.error("\nExample:");
    console.error('  select_card fuel_system_day2 "Maintenance has 100% engagement rate"');
    process.exit(1);
  }

  const cardId = args[0];
  const rationale = args.slice(1).join(' '); // Join remaining args as rationale

  try {
    await selectCard(cardId, rationale);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

main();
