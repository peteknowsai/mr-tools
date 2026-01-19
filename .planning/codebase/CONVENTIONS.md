# Coding Conventions

**Analysis Date:** 2025-01-19

## Naming Patterns

**Files:**
- CLI tools: `kebab-case.ts` (e.g., `slack-send.ts`, `gpt-image-gen.ts`)
- Library modules: `camelCase.ts` (e.g., `config.ts`, `checkpoint.ts`)
- Wrapper scripts in bin/: `kebab-case` (e.g., `grok`, `cal-com`, `google-maps`)
- Workflows: `snake_case.ts` (e.g., `gmail_latest_from.ts`, `generate_card_art.ts`)

**Functions:**
- camelCase for all functions (e.g., `getApiKey()`, `saveCheckpoint()`, `parseArgs()`)
- Prefix getters with `get` (e.g., `getSecret()`, `getBotToken()`, `getClientCreds()`)
- Prefix setters with `set` (e.g., `setSecret()`)
- Command handlers prefixed with `cmd` (e.g., `cmdConfig()`, `cmdList()`, `cmdDelete()`)
- Async functions use same conventions

**Variables:**
- camelCase for local variables (e.g., `authCode`, `jsonOutput`, `replicateKey`)
- SCREAMING_SNAKE_CASE for constants (e.g., `DEFAULT_MODEL`, `BASE_URL`, `TOKEN_DIR`)
- Object constants use SCREAMING_SNAKE_CASE with camelCase properties:
  ```typescript
  const STYLE_DESCRIPTIONS = {
    watercolor: '...',
    geometric: '...',
  } as const;
  ```

**Types:**
- PascalCase for type names (e.g., `Token`, `CLIArgs`, `Checkpoint`)
- Interfaces: PascalCase with descriptive names (e.g., `SessionCheckpoints`, `SaveCheckpointOptions`)
- Type inference from `z.infer<typeof Schema>` for Zod schemas
- Use `type` for simple unions, `interface` for object shapes with methods

## Code Style

**Formatting:**
- No explicit formatter configured (relies on editor defaults)
- 2-space indentation
- Semicolons at end of statements
- Double quotes for strings
- Trailing commas in multi-line arrays/objects

**Linting:**
- No ESLint/Prettier/Biome configuration
- TypeScript strict mode via Bun's built-in type checking
- Implicit type safety from `bun-types` package

## Import Organization

**Order:**
1. Node.js built-ins (fs, path, os)
2. External dependencies (@anthropic-ai/*, zod, etc.)
3. Internal library imports (../../lib/config, ../../lib/checkpoint)

**Pattern:**
```typescript
#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { z } from "zod";
import { getSecret, setSecret } from "../../lib/config";
```

**Path Aliases:**
- None configured - use relative paths
- Common pattern: `../../lib/config` from tools directory

## Error Handling

**Patterns:**
- Try-catch at top level with process.exit(1)
- Error messages via `console.error()`
- Prefer error messages with context:
  ```typescript
  throw new Error("Missing Grok API key. Set GROK_API_KEY or run: grok config set api-key <key>");
  ```
- Specific error codes for HTTP responses:
  ```typescript
  if (error.message.includes("429")) {
    throw new Error("Rate limit exceeded. Please wait and try again.");
  }
  ```

**Standard error exit pattern:**
```typescript
main().catch(e => {
  console.error(`Error: ${e?.message || e}`);
  process.exit(1);
});
```

**Validation errors (with Zod):**
```typescript
const result = Schema.safeParse(input);
if (!result.success) {
  const errors = result.error.errors
    .map(err => `  - ${err.path.join('.')}: ${err.message}`)
    .join('\n');
  throw new Error(`Validation failed:\n${errors}`);
}
```

## Logging

**Framework:** console (no external logging library)

**Patterns:**
- Success: `console.log()` with checkmark emoji: `"✓ Message sent"`
- Error: `console.error()` with `"Error: ..."` prefix
- Debug info: JSON output with `--json` flag
- Progress: Informational messages to stdout
- No logging levels beyond console methods

**Output conventions:**
```typescript
// Human-readable success
console.log(`✓ Message sent to ${channel}`);

// JSON mode for programmatic consumption
if (json) console.log(JSON.stringify(data, null, 2));

// Error with context
console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
```

## Comments

**When to Comment:**
- File-level JSDoc for CLI tools explaining purpose and usage
- Complex logic or non-obvious code
- Environment variable requirements
- API-specific behavior notes

**JSDoc/TSDoc:**
- File headers with usage examples for CLI tools:
  ```typescript
  /**
   * rewind - Time machine for Claude Code sessions
   *
   * Usage:
   *   rewind                                    # List checkpoints
   *   rewind day2 memory "what did you learn?"  # Query at checkpoint
   */
  ```
- Method documentation for library functions:
  ```typescript
  /**
   * Save a checkpoint to disk
   *
   * Creates or updates .agent-checkpoints.json with the checkpoint.
   * Overwrites existing checkpoint if same day/step already exists.
   */
  ```

## Function Design

**Size:**
- Prefer small, focused functions (10-50 lines)
- Main entry points can be larger for CLI argument handling
- Extract complex logic into helper functions

**Parameters:**
- Use options objects for functions with many parameters:
  ```typescript
  interface SaveCheckpointOptions {
    sessionId: string;
    userId: string;
    dayNumber: number;
    step: string;
    stepName: string;
    messageId: string;
    filepath?: string;
  }
  ```
- Optional parameters at end with defaults:
  ```typescript
  function loadCheckpoints(filepath: string = DEFAULT_CHECKPOINT_FILE): CheckpointStore
  ```

**Return Values:**
- Return typed objects, not tuples
- Use `Promise<T>` for async functions
- Return `undefined` for not-found cases (not `null`)

## Module Design

**Exports:**
- Named exports for library functions
- Default export for main class if it's the primary API
- Export interfaces/types that consumers need:
  ```typescript
  export interface Checkpoint { ... }
  export function saveCheckpoint(options: SaveCheckpointOptions): void { ... }
  ```

**Barrel Files:**
- Not used - import directly from source files

## CLI Tool Pattern

**Standard structure:**
1. Shebang: `#!/usr/bin/env bun`
2. Imports
3. Constants (API URLs, paths)
4. Type definitions
5. Helper functions (getApiKey, parseArgs, printHelp)
6. Command handlers (cmdConfig, cmdList, etc.)
7. Main function with switch/case for commands
8. Entry point: `main().catch(...)`

**Argument parsing:**
```typescript
type CLIArgs = {
  command?: string;
  args: string[];
  json?: boolean;
  // ... other flags
};

function parseArgs(argv: string[]): CLIArgs {
  const out: CLIArgs = { args: [], json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--flag") out.flag = argv[++i];
    else out.args.push(a);
  }
  return out;
}
```

**Config subcommand pattern:**
```typescript
async function cmdConfig(args: string[]) {
  if (args[0] === "show") {
    // Show current config
  }
  if (args[0] === "set" && args[1] === "api-key" && args[2]) {
    setSecret({ tool: "toolname", key: "api_key" }, args[2]);
    console.log("✓ API key saved");
    return;
  }
  printHelp();
}
```

## Secret Management Pattern

**Centralized config via `lib/config.ts`:**
```typescript
// Reading secrets - env vars take priority
const key = getSecret({
  tool: "toolname",
  key: "api_key",
  env: ["TOOL_API_KEY", "ALTERNATIVE_KEY"]
});

// Writing secrets
setSecret({ tool: "toolname", key: "api_key" }, value);
```

**Storage location:** `~/.config/mr-tools/secrets.json`

---

*Convention analysis: 2025-01-19*
