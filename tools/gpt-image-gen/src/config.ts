import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { Config } from "./types";

const CONFIG_DIR = join(homedir(), ".config", "gpt-image-gen");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export class ConfigManager {
  private config: Config = {};

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    if (existsSync(CONFIG_FILE)) {
      try {
        const data = readFileSync(CONFIG_FILE, "utf-8");
        this.config = JSON.parse(data);
      } catch (error) {
        console.error("Warning: Failed to load config file:", error);
      }
    }
  }

  private saveConfig(): void {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
  }

  getApiKey(): string | undefined {
    // ENV > tool-local config > central secrets
    const envKey = process.env.OPENAI_API_KEY?.trim();
    if (envKey) return envKey;
    
    const localKey = this.config.apiKey?.trim();
    if (localKey) return localKey;
    
    try {
      const centralPath = join(homedir(), ".config", "tool-library", "secrets.json");
      if (!existsSync(centralPath)) return undefined;
      const central = JSON.parse(readFileSync(centralPath, "utf-8"));
      const key = central?.openai?.api_key;
      return typeof key === "string" ? key.trim() : undefined;
    } catch (e) {
      console.error("Failed to read central config:", e);
      return undefined;
    }
  }

  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.saveConfig();
  }

  get(key: keyof Config): any {
    return this.config[key];
  }

  set(key: keyof Config, value: any): void {
    this.config[key] = value;
    this.saveConfig();
  }

  getAll(): Config {
    return { ...this.config };
  }

  clear(): void {
    this.config = {};
    this.saveConfig();
  }
}