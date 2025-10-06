#!/usr/bin/env bun

import { parseArgs } from "util";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { GPTImageAPI } from "./api";
import { ImageConverter } from "./converter";
import { ConfigManager } from "./config";
import type { CLIOptions, GenerateImageParams, GenerationResult } from "./types";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m"
};

class GPTImageCLI {
  private config: ConfigManager;
  
  constructor() {
    this.config = new ConfigManager();
  }

  /**
   * Main CLI entry point
   */
  async run(args: string[]): Promise<void> {
    try {
      const parsed = this.parseArguments(args);
      
      if (parsed.subcommand === "config") {
        await this.handleConfig(parsed.configArgs);
        return;
      }
      
      if (parsed.subcommand === "batch") {
        await this.handleBatch(parsed.batchFile!, parsed.options);
        return;
      }
      
      if (parsed.options.help) {
        this.showHelp();
        return;
      }
      
      if (!parsed.prompt) {
        console.error(`${colors.red}Error: No prompt provided${colors.reset}`);
        this.showHelp();
        process.exit(1);
      }
      
      await this.generateImage(parsed.prompt, parsed.options);
    } catch (error) {
      console.error(`${colors.red}Error: ${error}${colors.reset}`);
      process.exit(1);
    }
  }

  /**
   * Parse command line arguments
   */
  private parseArguments(args: string[]): {
    prompt?: string;
    options: CLIOptions;
    subcommand?: string;
    configArgs?: string[];
    batchFile?: string;
  } {
    // Check for subcommands
    if (args[0] === "config") {
      return {
        subcommand: "config",
        configArgs: args.slice(1),
        options: {}
      };
    }
    
    if (args[0] === "batch") {
      const batchFile = args[1];
      const { values } = parseArgs({
        args: args.slice(2),
        options: {
          "output-dir": { type: "string" },
          quality: { type: "string" },
          size: { type: "string" },
          format: { type: "string" },
          quiet: { type: "boolean" },
          json: { type: "boolean" }
        },
        strict: false,
        allowPositionals: false
      });
      
      return {
        subcommand: "batch",
        batchFile,
        options: {
          outputDir: values["output-dir"] as string,
          quality: values.quality as string,
          size: values.size as string,
          format: values.format as any,
          quiet: values.quiet as boolean,
          json: values.json as boolean
        }
      };
    }

    // Parse regular generation command
    const { values, positionals } = parseArgs({
      args,
      options: {
        output: { type: "string", short: "o" },
        "output-dir": { type: "string", short: "d" },
        size: { type: "string", short: "s" },
        quality: { type: "string", short: "q" },
        count: { type: "string", short: "n" },
        "api-key": { type: "string" },
        base64: { type: "boolean", short: "b" },
        format: { type: "string", short: "f" },
        "prompt-file": { type: "string", short: "p" },
        quiet: { type: "boolean" },
        json: { type: "boolean", short: "j" },
        help: { type: "boolean", short: "h" }
      },
      strict: false,
      allowPositionals: true
    });

    let prompt = positionals.join(" ");
    
    // Read prompt from file if specified
    if (values["prompt-file"]) {
      const promptFile = values["prompt-file"] as string;
      if (!existsSync(promptFile)) {
        throw new Error(`Prompt file not found: ${promptFile}`);
      }
      prompt = readFileSync(promptFile, "utf-8").trim();
    }

    return {
      prompt: prompt || undefined,
      options: {
        output: values.output as string,
        outputDir: values["output-dir"] as string,
        size: values.size as string,
        quality: values.quality as string,
        count: values.count ? parseInt(values.count as string) : undefined,
        apiKey: values["api-key"] as string,
        base64: values.base64 as boolean,
        format: values.format as any,
        promptFile: values["prompt-file"] as string,
        quiet: values.quiet as boolean,
        json: values.json as boolean,
        help: values.help as boolean
      }
    };
  }

  /**
   * Generate image(s) from prompt
   */
  private async generateImage(prompt: string, options: CLIOptions): Promise<void> {
    // Get API key
    const apiKey = options.apiKey || this.config.getApiKey();
    if (!apiKey) {
      throw new Error("OpenAI API key not found. Set OPENAI_API_KEY environment variable or use 'gpt-image-gen config set api-key'");
    }

    // Prepare parameters
    const params: GenerateImageParams = {
      prompt,
      size: (options.size || this.config.get("defaultSize") || "1024x1024") as any,
      quality: (options.quality || this.config.get("defaultQuality") || "medium") as any,
      n: options.count || 1
    };

    // Show progress
    if (!options.quiet) {
      console.log(`${colors.cyan}Generating ${params.n} image(s)...${colors.reset}`);
      console.log(`${colors.dim}Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}${colors.reset}`);
      console.log(`${colors.dim}Size: ${params.size}, Quality: ${params.quality}${colors.reset}`);
      console.log(`${colors.dim}Estimated cost: ${GPTImageAPI.estimateCost(params)}${colors.reset}`);
    }

    // Start timer
    const startTime = Date.now();

    // Generate images
    const api = new GPTImageAPI(apiKey);
    const base64Images = await api.generateImagesWithRetry(params);

    // Calculate generation time
    const generationTime = ((Date.now() - startTime) / 1000).toFixed(2);

    // Process results
    const results: GenerationResult[] = [];
    
    for (let i = 0; i < base64Images.length; i++) {
      const base64 = base64Images[i];
      
      if (options.base64) {
        // Output raw base64
        if (options.output && params.n === 1) {
          await Bun.write(options.output, base64);
          if (!options.quiet) {
            console.log(`${colors.green}✓ Base64 saved to ${options.output}${colors.reset}`);
          }
        } else {
          console.log(base64);
        }
      } else {
        // Convert and save as binary
        let outputPath: string;
        
        if (options.outputDir) {
          // Ensure directory exists
          if (!existsSync(options.outputDir)) {
            mkdirSync(options.outputDir, { recursive: true });
          }
          outputPath = join(
            options.outputDir,
            ImageConverter.generateFilename("image", options.format || "png", params.n > 1 ? i : undefined)
          );
        } else if (options.output && params.n === 1) {
          outputPath = options.output;
        } else {
          outputPath = ImageConverter.generateFilename("image", options.format || "png", params.n > 1 ? i : undefined);
        }
        
        const { path, size } = await ImageConverter.saveBase64ToFile(
          base64,
          outputPath,
          options.format
        );
        
        results.push({
          prompt,
          path,
          size,
          timestamp: Date.now(),
          parameters: {
            size: params.size!,
            quality: params.quality!
          }
        });
        
        if (!options.quiet) {
          console.log(`${colors.green}✓ Image saved to ${path} (${ImageConverter.formatFileSize(size)})${colors.reset}`);
        }
      }
    }

    // Output JSON if requested
    if (options.json && results.length > 0) {
      console.log(JSON.stringify(results, null, 2));
    }

    // Show completion message
    if (!options.quiet && !options.json) {
      console.log(`${colors.bright}${colors.green}✨ Generated ${params.n} image(s) in ${generationTime}s${colors.reset}`);
    }
  }

  /**
   * Handle batch processing
   */
  private async handleBatch(inputFile: string, options: CLIOptions): Promise<void> {
    if (!existsSync(inputFile)) {
      throw new Error(`Batch file not found: ${inputFile}`);
    }

    const prompts = readFileSync(inputFile, "utf-8")
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (prompts.length === 0) {
      throw new Error("No prompts found in batch file");
    }

    const outputDir = options.outputDir || "./batch-output";
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    console.log(`${colors.cyan}Processing ${prompts.length} prompts...${colors.reset}`);

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      console.log(`${colors.dim}[${i + 1}/${prompts.length}] ${prompt.substring(0, 50)}${prompt.length > 50 ? "..." : ""}${colors.reset}`);
      
      await this.generateImage(prompt, {
        ...options,
        outputDir,
        quiet: true
      });
    }

    console.log(`${colors.bright}${colors.green}✨ Batch processing complete!${colors.reset}`);
  }

  /**
   * Handle config subcommand
   */
  private async handleConfig(args: string[]): Promise<void> {
    if (args.length === 0) {
      // Show current config
      const config = this.config.getAll();
      console.log("Current configuration:");
      console.log(JSON.stringify(config, null, 2));
      return;
    }

    const action = args[0];
    
    if (action === "set") {
      if (args.length < 3) {
        console.error("Usage: gpt-image-gen config set <key> <value>");
        process.exit(1);
      }
      
      const key = args[1];
      const value = args.slice(2).join(" ");
      
      if (key === "api-key") {
        this.config.setApiKey(value);
        console.log(`${colors.green}✓ API key saved${colors.reset}`);
      } else {
        this.config.set(key as any, value);
        console.log(`${colors.green}✓ ${key} set to: ${value}${colors.reset}`);
      }
    } else if (action === "get") {
      const key = args[1];
      const value = this.config.get(key as any);
      console.log(value || "(not set)");
    } else if (action === "clear") {
      this.config.clear();
      console.log(`${colors.green}✓ Configuration cleared${colors.reset}`);
    } else {
      console.error(`Unknown config action: ${action}`);
      console.error("Available actions: set, get, clear");
      process.exit(1);
    }
  }

  /**
   * Show help message
   */
  private showHelp(): void {
    console.log(`
${colors.bright}gpt-image-gen${colors.reset} - Generate images using OpenAI's GPT-Image-1 model

${colors.bright}Usage:${colors.reset}
  gpt-image-gen "prompt" [options]
  gpt-image-gen batch <file> [options]
  gpt-image-gen config <action> [args]

${colors.bright}Options:${colors.reset}
  -o, --output FILE       Output file path
  -d, --output-dir DIR    Output directory for multiple images
  -s, --size SIZE         Image size (1024x1024, 1024x1536, 1536x1024)
  -q, --quality QUALITY   Quality (low, medium, high, auto)
  -n, --count N           Number of images (1-10)
  -f, --format FORMAT     Output format (png, jpg, webp)
  -p, --prompt-file FILE  Read prompt from file
  -b, --base64           Output raw base64 instead of binary
  -j, --json             Output metadata as JSON
  --api-key KEY          OpenAI API key
  --quiet                Suppress progress messages
  -h, --help             Show this help

${colors.bright}Examples:${colors.reset}
  # Basic usage
  gpt-image-gen "A sunset over mountains" --output sunset.png

  # Multiple images with options
  gpt-image-gen "A happy dog" --size 1024x1536 --quality high --count 3 --output-dir ./dogs/

  # Batch processing
  echo "A cat\\nA dog\\nA bird" > prompts.txt
  gpt-image-gen batch prompts.txt --output-dir ./animals/

  # Configuration
  gpt-image-gen config set api-key sk-...
  gpt-image-gen config set defaultQuality high

${colors.bright}Environment:${colors.reset}
  OPENAI_API_KEY    Your OpenAI API key

${colors.dim}Model: GPT-Image-1 | Response: Base64 only${colors.reset}
`);
  }
}

// Run CLI if executed directly
if (import.meta.main) {
  const cli = new GPTImageCLI();
  cli.run(Bun.argv.slice(2));
}