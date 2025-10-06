export interface GenerateImageParams {
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  quality?: "low" | "medium" | "high" | "auto";
  n?: number; // 1-10
}

export interface ImageGenerationResponse {
  created: number;
  data: Array<{
    b64_json: string;
  }>;
}

export interface CLIOptions {
  output?: string;
  outputDir?: string;
  size?: string;
  quality?: string;
  count?: number;
  apiKey?: string;
  base64?: boolean;
  format?: "png" | "jpg" | "webp";
  promptFile?: string;
  quiet?: boolean;
  json?: boolean;
}

export interface BatchOptions extends CLIOptions {
  inputFile: string;
}

export interface Config {
  apiKey?: string;
  defaultQuality?: string;
  defaultSize?: string;
  defaultOutputDir?: string;
}

export interface GenerationResult {
  prompt: string;
  path?: string;
  base64?: string;
  size: number;
  timestamp: number;
  parameters: {
    size: string;
    quality: string;
  };
}