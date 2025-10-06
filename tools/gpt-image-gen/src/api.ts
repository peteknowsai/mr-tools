import type { GenerateImageParams, ImageGenerationResponse, GenerationResult } from "./types";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export class GPTImageAPI {
  private apiKey: string;
  private baseURL = "https://api.openai.com/v1/images/generations";
  private projectId?: string;
  private organizationId?: string;
  
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }
    this.apiKey = apiKey.trim();

    // Optional: support project/org scoping headers for newer OpenAI setups
    this.projectId = (process.env.OPENAI_PROJECT || process.env.OPENAI_PROJECT_ID || this.readCentral("openai", ["project_id", "project"]) || "").trim() || undefined;
    this.organizationId = (process.env.OPENAI_ORG || process.env.OPENAI_ORGANIZATION || this.readCentral("openai", ["organization", "org"]) || "").trim() || undefined;
  }

  private readCentral(section: string, keys: string[]): string | undefined {
    try {
      const centralPath = join(homedir(), ".config", "tool-library", "secrets.json");
      if (!existsSync(centralPath)) return undefined;
      const all = JSON.parse(readFileSync(centralPath, "utf8"));
      const obj = all?.[section] || {};
      for (const k of keys) {
        if (typeof obj[k] === "string" && obj[k]) return obj[k];
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Generate images using GPT-Image-1 model
   */
  async generateImages(params: GenerateImageParams): Promise<string[]> {
    // Validate parameters
    this.validateParams(params);

    const requestBody: any = {
      model: "gpt-image-1", // CRITICAL: Must be gpt-image-1
      prompt: params.prompt,
      size: params.size || "1024x1024",
      quality: params.quality || "medium",
      n: params.n || 1
      // Note: gpt-image-1 doesn't accept response_format parameter
    };

    try {
      const headers: Record<string, string> = {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      };
      if (this.projectId) headers["OpenAI-Project"] = this.projectId;
      if (this.organizationId) headers["OpenAI-Organization"] = this.organizationId;

      const response = await fetch(this.baseURL, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(`API Error (${response.status}): ${error.error?.message || "Unknown error"}`);
      }

      const data: ImageGenerationResponse = await response.json();
      return data.data.map(img => img.b64_json);
    } catch (error) {
      if (error instanceof Error) {
        // Handle specific error types
        if (error.message.includes("429")) {
          throw new Error("Rate limit exceeded. Please wait and try again.");
        }
        if (error.message.includes("401")) {
          throw new Error("Invalid API key. Please check your OpenAI API key.");
        }
        if (error.message.includes("400")) {
          throw new Error("Invalid request. Please check your prompt and parameters.");
        }
        throw error;
      }
      throw new Error("Unknown error occurred");
    }
  }

  /**
   * Generate images with retry logic for rate limits
   */
  async generateImagesWithRetry(
    params: GenerateImageParams,
    maxRetries: number = 3
  ): Promise<string[]> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.generateImages(params);
      } catch (error) {
        lastError = error as Error;
        
        // Only retry on rate limit errors
        if (lastError.message.includes("Rate limit")) {
          const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        // For other errors, throw immediately
        throw error;
      }
    }
    
    throw lastError || new Error("Failed after retries");
  }

  /**
   * Validate generation parameters
   */
  private validateParams(params: GenerateImageParams): void {
    // Validate prompt
    if (!params.prompt || params.prompt.trim().length === 0) {
      throw new Error("Prompt cannot be empty");
    }
    
    if (params.prompt.length > 4000) {
      throw new Error("Prompt exceeds maximum length of 4000 characters");
    }
    
    // Validate n (count)
    if (params.n !== undefined) {
      if (params.n < 1 || params.n > 10) {
        throw new Error("Image count must be between 1 and 10");
      }
    }
    
    // Validate size
    const validSizes = ["1024x1024", "1024x1536", "1536x1024"];
    if (params.size && !validSizes.includes(params.size)) {
      throw new Error(`Invalid size. Must be one of: ${validSizes.join(", ")}`);
    }
    
    // Validate quality
    const validQualities = ["low", "medium", "high", "auto"];
    if (params.quality && !validQualities.includes(params.quality)) {
      throw new Error(`Invalid quality. Must be one of: ${validQualities.join(", ")}`);
    }
  }

  /**
   * Estimate API cost
   */
  static estimateCost(params: GenerateImageParams): string {
    // Rough cost estimates (adjust based on actual OpenAI pricing)
    const baseCost = 0.02; // Base cost per image
    const qualityMultiplier = {
      low: 0.5,
      medium: 1,
      high: 2,
      auto: 1.5
    };
    const sizeMultiplier = {
      "1024x1024": 1,
      "1024x1536": 1.5,
      "1536x1024": 1.5
    };
    
    const quality = params.quality || "medium";
    const size = params.size || "1024x1024";
    const count = params.n || 1;
    
    const cost = baseCost * 
      qualityMultiplier[quality] * 
      sizeMultiplier[size] * 
      count;
    
    return `$${cost.toFixed(3)}`;
  }
}