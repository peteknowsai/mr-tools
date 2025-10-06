import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const ROOT_DIR = join(homedir(), ".config", "mr-tools");
const SECRETS_FILE = join(ROOT_DIR, "secrets.json");

export type SecretLookup = {
  tool: string;           // e.g., 'uploadthing', 'openai', 'cloudflare'
  key: string;            // e.g., 'api_key', 'api_token', 'account_id'
  env?: string[];         // env var fallbacks in priority order
};

export function readSecrets(): any {
  try {
    if (!existsSync(SECRETS_FILE)) return {};
    return JSON.parse(readFileSync(SECRETS_FILE, "utf8"));
  } catch {
    return {};
  }
}

export function writeSecrets(obj: any): void {
  if (!existsSync(ROOT_DIR)) mkdirSync(ROOT_DIR, { recursive: true });
  writeFileSync(SECRETS_FILE, JSON.stringify(obj, null, 2));
}

export function getSecret({ tool, key, env = [] }: SecretLookup): string | undefined {
  for (const name of env) {
    if (process.env[name]) return process.env[name];
  }
  const all = readSecrets();
  return all?.[tool]?.[key];
}

export function setSecret({ tool, key }: { tool: string; key: string }, value: string): void {
  const all = readSecrets();
  if (!all[tool]) all[tool] = {};
  all[tool][key] = value;
  writeSecrets(all);
}

export function getConfigPath(): string {
  return SECRETS_FILE;
}
