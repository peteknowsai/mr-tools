#!/usr/bin/env bun
import { z } from "zod";
import { mkdir } from "fs/promises";
import { join } from "path";

// Zod schema matching @peteknowsai/types ImageCardItem (v3.0.0)
const ImageCardItemSchema = z.object({
  id: z.string().min(1, "Card ID is required"),
  type: z.literal("image_card", {
    errorMap: () => ({ message: 'Type must be "image_card"' }),
  }),
  title: z.string().min(3, "Title must be at least 3 characters").max(50, "Title must be 50 characters or less"),
  subtext: z.string().min(20, "Subtext must be at least 20 characters").max(300, "Subtext must be 300 characters or less"),
  content_markdown: z.string().min(100, "Content markdown must be at least 100 characters"),
  image: z.string().url("Image must be a valid URL").startsWith("https://imagedelivery.net/", "Image must be a Cloudflare Images URL"),
  backgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i, "Background color must be a valid hex color").optional(),
  theme: z.enum([
    "maintenance",
    "weather",
    "community",
    "navigation",
    "scenic",
    "welcome",
  ]).optional(),
  metadata: z.object({
    reporter: z.string().optional(),
    topics: z.array(z.string()).optional(),
  }).optional(),
});

type ImageCardItem = z.infer<typeof ImageCardItemSchema>;

// Storage directory
const CARDS_DIR = "/tmp/captain32-cards";

async function readStdin(): Promise<string> {
  const chunks: string[] = [];

  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(Buffer.from(chunk).toString());
  }

  return chunks.join("");
}

async function submitCard(cardJson: string, reporterArg: string): Promise<void> {
  // Parse JSON
  let cardData: unknown;
  try {
    cardData = JSON.parse(cardJson);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Validate with Zod
  const result = ImageCardItemSchema.safeParse(cardData);

  if (!result.success) {
    // Handle Bun-compiled binary error structure
    const zodError = result.error;
    let errorMessages: string;

    if (zodError.errors && Array.isArray(zodError.errors)) {
      // Standard Zod error structure
      errorMessages = zodError.errors
        .map(err => `  - ${err.path.join('.')}: ${err.message}`)
        .join('\n');
    } else if (zodError.message) {
      // Bun compiled structure - error.message contains JSON
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

  const card: ImageCardItem = result.data;

  // Ensure storage directory exists
  await mkdir(CARDS_DIR, { recursive: true });

  // Generate filename: {timestamp}_{reporter}.json
  const timestamp = Date.now();
  const filename = `${timestamp}_${reporterArg}.json`;
  const filepath = join(CARDS_DIR, filename);

  // Write card to file
  await Bun.write(filepath, JSON.stringify(card, null, 2));

  // Output success message
  console.log(`✅ Card submitted: ${card.id}`);
  console.log(`📁 ${filepath}`);
}

async function main() {
  try {
    // Parse --reporter argument (REQUIRED)
    const args = process.argv.slice(2);
    const reporterIndex = args.indexOf('--reporter');

    if (reporterIndex === -1 || !args[reporterIndex + 1]) {
      console.error("❌ Error: --reporter argument is required");
      console.error("\nUsage:");
      console.error("  submit_card --reporter <reporter_name> <<'EOF'");
      console.error("  {");
      console.error('    "id": "fuel_system_day2",');
      console.error('    "type": "image_card",');
      console.error("    ...");
      console.error("  }");
      console.error("  EOF");
      console.error("\nExample:");
      console.error("  submit_card --reporter boat_maintenance <<'EOF'");
      console.error("  {...}");
      console.error("  EOF");
      console.error("\nValid reporters: boat_maintenance, fishing_reports, weather_conditions, maritime_news");
      process.exit(1);
    }

    const reporterArg = args[reporterIndex + 1];
    const input = await readStdin();

    if (!input.trim()) {
      console.error("❌ Error: No input provided. Pipe card JSON to stdin.");
      console.error("\nUsage:");
      console.error("  submit_card --reporter <reporter_name> <<'EOF'");
      console.error("  {...}");
      console.error("  EOF");
      process.exit(1);
    }

    await submitCard(input, reporterArg);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

main();
