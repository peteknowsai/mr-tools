# Architecture Analysis

**Analysis Date:** 2026-01-20

## Directory Structure

```
mr-tools/
├── bin/             # Thin wrapper scripts (entry points)
├── tools/           # Individual tool implementations
├── lib/             # Shared libraries
├── workflows/       # Workflow-specific focused tools
├── hooks/           # Claude Code hooks (auto-capture)
├── node_modules/    # Dependencies
└── package.json     # Project manifest
```

## Pattern Overview

**Overall:** Two-Tier Tool Architecture

**Key Characteristics:**
- Tier 1: General CLI tools in `tools/` - flexible, exploratory, multi-command
- Tier 2: Workflow tools in `workflows/` - single-purpose, optimized for specific patterns
- Entry points in `bin/` are thin wrappers that import tool implementations
- Shared configuration via `lib/config.ts` for centralized secrets management

## Tool Organization

**Tool Directory Pattern:** Each tool lives in `tools/{tool-name}/`

**Standard Structure:**
```
tools/{name}/
├── {name}.ts          # Main implementation (TypeScript/Bun)
├── CLAUDE.md          # AI instructions for using the tool (optional)
└── README.md          # Human documentation (optional)
```

**Complex Tools** (like `gpt-image-gen`) may have additional structure:
```
tools/gpt-image-gen/
├── src/
│   ├── cli.ts         # CLI entry point
│   ├── api.ts         # API client
│   ├── config.ts      # Tool-specific config
│   ├── types.ts       # TypeScript types
│   └── converter.ts   # Utilities
└── build.ts           # Build script
```

**Language Support:**
- **TypeScript/Bun** (primary): Most tools (`grok`, `cal-com`, `gmail`, `rewind`, `jump`)
- **Python** (secondary): `nanobanana` uses Python with venv

## Entry Points

**Pattern:** `bin/{tool-name}` are thin wrappers

**TypeScript Tools:**
```typescript
#!/usr/bin/env bun
import "../tools/grok/grok.ts";
```

**Python Tools:**
```bash
#!/bin/bash
exec "${VENV_PYTHON}" "${TOOL_DIR}/nanobanana.py" "$@"
```

**Key Files:**
- `bin/grok`: Imports `tools/grok/grok.ts`
- `bin/cal-com`: Imports `tools/cal-com/cal-com.ts`
- `bin/nanobanana`: Shell wrapper for Python venv

## Shared Code

**`lib/config.ts`** - Centralized secrets management

**Functions:**
- `getSecret({ tool, key, env })` - Get secret with env var fallback
- `setSecret({ tool, key }, value)` - Store secret
- `readSecrets()` / `writeSecrets()` - Raw JSON access

**Storage Location:** `~/.config/mr-tools/secrets.json`

**Usage Pattern:**
```typescript
import { getSecret, setSecret } from "../../lib/config";

// Get API key with env fallback
const key = getSecret({
  tool: "grok",
  key: "api_key",
  env: ["GROK_API_KEY", "XAI_API_KEY"]
});

// Set via CLI
setSecret({ tool: "grok", key: "api_key" }, value);
```

**`lib/checkpoint.ts`** - Checkpoint system for agent session management

**Functions:**
- `saveCheckpoint()` - Save checkpoint to `.agent-checkpoints.json`
- `loadCheckpoints()` / `getCheckpoint()` - Read checkpoints
- `saveAutoCheckpoint()` - Auto-capture with AI-generated labels
- `findCheckpointByLabel()` - Search by partial match

**Used By:**
- `tools/rewind/rewind.ts` - Time machine for agent sessions
- `tools/jump/jump.ts` - Auto-labeled navigation
- `tools/checkpoint-auto-capture.ts` - Hook for auto-capture

## CLI Pattern

**Standard CLI Structure:**
```typescript
#!/usr/bin/env bun
import { getSecret, setSecret } from "../../lib/config";

function printHelp() { /* Usage info */ }
function parseArgs(argv: string[]): CLIArgs { /* Parse args */ }

// Subcommands
async function cmdConfig(args: string[]) { /* config set/show */ }
async function cmdMain(args: string[], json: boolean) { /* primary action */ }

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === "-h" || argv[0] === "--help") {
    printHelp();
    return;
  }
  const a = parseArgs(argv);
  switch (a.command) {
    case "config": return cmdConfig(a.args);
    default: return cmdMain(a.args, !!a.json);
  }
}

main().catch(e => { console.error(`Error: ${e?.message || e}`); process.exit(1); });
```

**Common Flags:**
- `--json` - Structured output for programmatic use
- `--help` / `-h` - Show usage
- `config set {key} {value}` - Store secrets
- `config show` - Display config status

## Distribution

**Installation Script:** `install-tool.sh`

**Purpose:** Move compiled binaries from `bin/` to `~/.local/bin/` to prevent Claude Code checkpoint bloat

**Usage:**
```bash
./install-tool.sh grok
```

**Process:**
1. Creates `~/.local/bin/` if needed
2. Adds to PATH in `.zshrc` / `.bashrc`
3. Moves binary from `bin/` to `~/.local/bin/`

**Binary Compilation:**
```bash
bun build ./tools/grok/grok.ts --compile --outfile ./bin/grok
./install-tool.sh grok
```

**Note:** The `bin/` directory contains thin wrapper scripts for development. Compiled binaries should be moved to `~/.local/bin/` for production use.

## Workflow Tools

**Location:** `workflows/{domain}/`

**Pattern:** Single-purpose wrappers around general CLI tools

**Structure:**
```
workflows/
├── auth/         # Authentication workflows
├── email/        # Email-specific workflows
├── scheduling/   # Calendar workflows
└── content/      # Publishing workflows
```

**Naming Convention:** `{domain}_{action}_{specifics}`
- `gmail_clerk_pin` - Get Clerk verification code
- `cal_today` - Show today's calendar
- `gmail_latest_from` - Get latest email from sender

**Philosophy:** Tier 2 tools are laser-focused for known agent workflows, vs Tier 1 general tools that support exploration.

## Data Flow

**Configuration Flow:**
1. CLI receives command
2. `lib/config.ts` checks env vars first
3. Falls back to `~/.config/mr-tools/secrets.json`
4. Tool uses secret for API calls

**Checkpoint Flow:**
1. Agent saves checkpoint via `lib/checkpoint.ts`
2. Stored in `.agent-checkpoints.json` (project-local)
3. `rewind` or `jump` tools query checkpoints
4. Uses Claude Agent SDK to resume at checkpoint

## Cross-Cutting Concerns

**Error Handling:** Try/catch with `process.exit(1)` on failure

**Output Modes:**
- Human-readable (default)
- JSON (`--json` flag) for programmatic use

**Authentication:** Per-tool secrets stored centrally, env vars take priority

---

*Architecture analysis: 2026-01-20*
