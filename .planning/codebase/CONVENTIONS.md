# Coding Conventions

**Analysis Date:** 2026-01-20

## Naming Patterns

**Files:**
- Tool entry points: `{tool-name}.ts` matching directory name (e.g., `tools/grok/grok.ts`)
- Workflow files: `snake_case.ts` (e.g., `workflows/scheduling/cal_today.ts`)
- Shared libraries: `camelCase.ts` (e.g., `lib/config.ts`, `lib/checkpoint.ts`)
- Multi-file tools: `src/` subdirectory with `cli.ts`, `api.ts`, `types.ts`, `config.ts`

**Functions:**
- `camelCase` for all functions
- Prefix with verb: `getSecret()`, `setSecret()`, `loadCheckpoints()`, `saveCheckpoint()`
- API functions: `getApiKey()`, `callMaps()`, `postMessage()`
- CLI handlers: `cmdConfig()`, `cmdList()`, `printHelp()`

**Variables:**
- `camelCase` for local variables
- `UPPER_SNAKE_CASE` for constants: `DEFAULT_MODEL`, `BASE_URL`, `CONFIG_DIR`
- Type aliases: `PascalCase` (e.g., `CLIArgs`, `Token`, `Checkpoint`)

**CLI Commands:**
- Binary names: `kebab-case` (e.g., `gpt-image-gen`, `google-maps`, `slack-send`)
- Subcommands: lowercase words (e.g., `config set`, `config show`, `place-search`)
- Flags: `--kebab-case` (e.g., `--output-dir`, `--api-key`, `--json`)

## Code Style

**Shebang:**
All tool entry points start with:
```typescript
#!/usr/bin/env bun
```

**Imports:**
1. Node built-ins first: `fs`, `os`, `path`, `util`
2. External packages second
3. Local imports last (relative paths with `../../lib/`)

```typescript
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getSecret, setSecret } from "../../lib/config";
```

**Type Definitions:**
- Define types inline in single-file tools
- Use dedicated `types.ts` for multi-file tools
- Prefer `type` over `interface` for simple structures

```typescript
type CLIArgs = {
  command?: string;
  args: string[];
  json?: boolean;
  num?: number;
};
```

**CLI Structure Pattern:**
Every CLI tool follows this structure:

```typescript
#!/usr/bin/env bun
import { getSecret, setSecret } from "../../lib/config";

// Constants at top
const DEFAULT_MODEL = process.env.X_MODEL || "default";
const BASE_URL = "https://api.example.com";

// Type definitions
type CLIArgs = { command?: string; args: string[]; json?: boolean };

// Helper to get API key (env first, then config)
function getApiKey(): string | undefined {
  return getSecret({ tool: "toolname", key: "api_key", env: ["TOOL_API_KEY"] });
}

// Help text function
function printHelp() {
  console.log(`Tool CLI (Bun)

Usage:
  tool command [options]
  tool config set api-key <key>
  tool config show
`);
}

// Argument parser
function parseArgs(argv: string[]): CLIArgs {
  const out: CLIArgs = { args: [], json: false };
  if (!argv.length) return out;
  out.command = argv[0];
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else out.args.push(a);
  }
  return out;
}

// Config subcommand handler
async function cmdConfig(args: string[]) {
  if (args[0] === "show") {
    const has = !!getApiKey();
    console.log(JSON.stringify({ has_api_key: has }, null, 2));
    return;
  }
  if (args[0] === "set" && args[1] === "api-key" && args[2]) {
    setSecret({ tool: "toolname", key: "api_key" }, args[2]);
    console.log("API key saved");
    return;
  }
  printHelp();
}

// Main function
async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === "-h" || argv[0] === "--help") { printHelp(); return; }
  const a = parseArgs(argv);
  switch (a.command) {
    case "config": return cmdConfig(a.args);
    // ... other commands
    default: return printHelp();
  }
}

main().catch(e => { console.error(`Error: ${e?.message || e}`); process.exit(1); });
```

**JSON Output:**
Every command supports `--json` flag for machine-readable output:

```typescript
if (json) console.log(JSON.stringify(data, null, 2));
else console.log(humanReadableFormat);
```

## Configuration

**Central Secrets Management:**
All tools use `lib/config.ts` for secrets:

```typescript
import { getSecret, setSecret } from "../../lib/config";

// Get with env fallback
const key = getSecret({
  tool: "toolname",
  key: "api_key",
  env: ["TOOL_API_KEY", "ALTERNATE_KEY"]
});

// Set secret
setSecret({ tool: "toolname", key: "api_key" }, value);
```

**Secrets file location:** `~/.config/mr-tools/secrets.json`

**Priority order:**
1. Environment variables (highest)
2. Central secrets file
3. Tool-local config (legacy fallback)

**Config Subcommand Pattern:**
Every tool implements:
```bash
tool config set api-key <key>   # Save API key
tool config show                # Show config status (never show actual keys)
```

**Token Storage (OAuth tools):**
OAuth tokens stored separately: `~/.config/tool-library/{tool}/token.json`

## Error Handling

**Main entry pattern:**
```typescript
main().catch(e => {
  console.error(`Error: ${e?.message || e}`);
  process.exit(1);
});
```

**API error checking:**
```typescript
const res = await fetch(url);
const data = await res.json();
if (!res.ok || data.error) {
  throw new Error(data.error?.message || data.error_description || res.statusText);
}
```

**Missing config errors:**
```typescript
if (!key) {
  throw new Error("Missing API key. Set TOOL_API_KEY or run: tool config set api-key <key>");
}
```

**Die helper (for fatal errors):**
```typescript
function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}
```

## Documentation

**Tool-level CLAUDE.md:**
Each tool has `tools/{tool}/CLAUDE.md` with:
- When to use the tool automatically
- Key commands and examples
- Integration patterns with other tools
- Error handling guidance
- AI-specific usage instructions

**Project-level CLAUDE.md:**
Root `CLAUDE.md` contains:
- Repository overview
- MCP architecture documentation
- Installation workflows
- Cross-tool patterns

**Help text:**
Every tool implements `printHelp()` with:
- Usage examples
- Available commands
- Option descriptions
- Notes on required setup

## Wrapper Scripts

**bin/ directory pattern:**
Wrapper scripts in `bin/` import and run the tool:

```typescript
#!/usr/bin/env bun
import "../tools/grok/grok.ts";
```

**Benefits:**
- Small files (under 100 bytes)
- Can be run directly with `bun`
- Compiled binaries go to `~/.local/bin/` via `install-tool.sh`

## Class-based Tools

**For complex tools (multi-file):**
Use class pattern as in `gpt-image-gen`:

```typescript
class ToolCLI {
  private config: ConfigManager;

  constructor() {
    this.config = new ConfigManager();
  }

  async run(args: string[]): Promise<void> {
    // Entry point
  }

  private parseArguments(args: string[]) {
    // Argument parsing
  }

  private showHelp(): void {
    // Help text
  }
}

if (import.meta.main) {
  const cli = new ToolCLI();
  cli.run(Bun.argv.slice(2));
}
```

## Output Formatting

**Success messages:**
```typescript
console.log("Message sent to #channel");
console.log("API key saved");
```

**Progress indicators (non-quiet mode):**
```typescript
if (!options.quiet) {
  console.log(`Generating ${n} image(s)...`);
}
```

**Color usage (optional, for rich CLI):**
```typescript
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  dim: "\x1b[2m"
};
console.log(`${colors.green}Success${colors.reset}`);
```

---

*Convention analysis: 2026-01-20*
