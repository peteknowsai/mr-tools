#!/usr/bin/env bun
import Replicate from "replicate";
import { getSecret, setSecret } from "../../lib/config";

function getApiKey(): string | undefined {
  return getSecret({ tool: "replicate", key: "api_key", env: ["REPLICATE_API_TOKEN", "REPLICATE_API_KEY"] });
}

function printHelp() {
  console.log(`Replicate CLI - Run AI models via Replicate API

Usage:
  replicate config set api-key <key>
  replicate config show

  replicate run <model> --prompt "<text>" [options]
  replicate get-prediction <id>

Run Options:
  --prompt <text>       Required: Image generation prompt
  --width <number>      Image width (default: 1024)
  --height <number>     Image height (default: 576)
  --aspect-ratio <w:h>  Alternative to width/height (e.g., "16:9")
  --output-format <fmt> Output format: jpg, png, webp (default: jpg)
  --output-quality <n>  Quality 0-100 (default: 90)
  --json                Output raw JSON response

Examples:
  replicate run stability-ai/sdxl --prompt "sailboat at sunset"
  replicate run black-forest-labs/flux-schnell --prompt "boat" --width 1024 --height 576
  replicate run google/nano-banana --prompt "marina scene" --aspect-ratio 16:9
`);
}

type CLIArgs = {
  command?: string;
  args: string[];
  json?: boolean;
  prompt?: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  outputFormat?: string;
  outputQuality?: number;
};

function parseArgs(argv: string[]): CLIArgs {
  const out: CLIArgs = { args: [], json: false };
  if (!argv.length) return out;

  out.command = argv[0];

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") {
      out.json = true;
    } else if (a === "--prompt") {
      out.prompt = argv[++i];
    } else if (a === "--width") {
      out.width = parseInt(argv[++i], 10);
    } else if (a === "--height") {
      out.height = parseInt(argv[++i], 10);
    } else if (a === "--aspect-ratio") {
      out.aspectRatio = argv[++i];
    } else if (a === "--output-format") {
      out.outputFormat = argv[++i];
    } else if (a === "--output-quality") {
      out.outputQuality = parseInt(argv[++i], 10);
    } else {
      out.args.push(a);
    }
  }

  return out;
}

async function cmdRun(args: CLIArgs) {
  const key = getApiKey();
  if (!key) {
    throw new Error("Missing Replicate API key. Set REPLICATE_API_KEY or run: replicate config set api-key <key>");
  }

  const model = args.args[0];
  if (!model) {
    console.error("Error: Model name required");
    printHelp();
    process.exit(1);
  }

  if (!args.prompt) {
    console.error("Error: --prompt required");
    printHelp();
    process.exit(1);
  }

  const replicate = new Replicate({ auth: key });

  // Build input object based on model
  const input: any = {
    prompt: args.prompt,
  };

  // Add dimensions if provided
  if (args.aspectRatio) {
    input.aspect_ratio = args.aspectRatio;
  } else {
    if (args.width) input.width = args.width;
    if (args.height) input.height = args.height;
  }

  // Add output options
  if (args.outputFormat) input.output_format = args.outputFormat;
  if (args.outputQuality) input.output_quality = args.outputQuality;

  try {
    const output = await replicate.run(model as any, { input });

    if (args.json) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      // Most image models return an array with a URL or a single URL
      if (Array.isArray(output)) {
        console.log(output[0]);
      } else {
        console.log(output);
      }
    }
  } catch (error) {
    console.error("Error running model:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function cmdGetPrediction(id: string, json: boolean) {
  const key = getApiKey();
  if (!key) {
    throw new Error("Missing Replicate API key. Set REPLICATE_API_KEY or run: replicate config set api-key <key>");
  }

  const replicate = new Replicate({ auth: key });

  try {
    const prediction = await replicate.predictions.get(id);

    if (json) {
      console.log(JSON.stringify(prediction, null, 2));
    } else {
      console.log(`Status: ${prediction.status}`);
      if (prediction.output) {
        console.log(`Output: ${JSON.stringify(prediction.output)}`);
      }
      if (prediction.error) {
        console.log(`Error: ${prediction.error}`);
      }
    }
  } catch (error) {
    console.error("Error fetching prediction:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function cmdConfig(args: string[]) {
  if (args[0] === "show") {
    const has = !!getApiKey();
    console.log(JSON.stringify({ has_api_key: has }, null, 2));
    return;
  }

  if (args[0] === "set" && args[1] === "api-key" && args[2]) {
    setSecret({ tool: "replicate", key: "api_key" }, args[2]);
    console.log("✓ API key saved to ~/.config/mr-tools/secrets.json under 'replicate.api_key'");
    return;
  }

  printHelp();
}

async function main() {
  const argv = process.argv.slice(2);

  if (!argv.length || argv[0] === "-h" || argv[0] === "--help") {
    printHelp();
    return;
  }

  const a = parseArgs(argv);

  switch (a.command) {
    case "config":
      return cmdConfig(a.args);
    case "run":
      return cmdRun(a);
    case "get-prediction":
      if (!a.args[0]) {
        console.error("Error: Prediction ID required");
        printHelp();
        process.exit(1);
      }
      return cmdGetPrediction(a.args[0], !!a.json);
    default:
      printHelp();
  }
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
