# Architecture

**Analysis Date:** 2026-01-19

## Pattern Overview

**Overall:** Two-Tier CLI Tool Library with Shared Infrastructure

**Key Characteristics:**
- Standalone CLI tools organized by category (general vs workflow-specific)
- Centralized secrets management via shared library
- Thin wrapper scripts in `bin/` delegate to TypeScript/Python implementations
- Tools compile to Bun binaries and install to `~/.local/bin/` for global access
- Optional Claude Code hooks enable auto-checkpointing

## Layers

**Shared Libraries (`lib/`):**
- Purpose: Common utilities shared across all tools
- Location: `/Users/pete/Projects/mr-tools/lib/`
- Contains: Secrets management, checkpoint persistence
- Depends on: Node.js fs/os modules, Claude Agent SDK
- Used by: All CLI tools, workflow scripts, hook scripts

**General CLI Tools (`tools/`):**
- Purpose: Flexible, multi-command tools for varied tasks
- Location: `/Users/pete/Projects/mr-tools/tools/{tool-name}/`
- Contains: TypeScript/Python implementations with subcommands
- Depends on: `lib/config.ts` for secrets, external APIs
- Used by: Users directly, workflow tools, Claude Code sessions

**Workflow Tools (`workflows/`):**
- Purpose: Single-purpose tools optimized for specific agent patterns
- Location: `/Users/pete/Projects/mr-tools/workflows/{category}/`
- Contains: Focused scripts that wrap general tools
- Depends on: General CLI tools, `lib/` functions
- Used by: Autonomous agents with known workflows

**Binary Wrappers (`bin/`):**
- Purpose: Thin shell scripts that invoke tool implementations
- Location: `/Users/pete/Projects/mr-tools/bin/`
- Contains: 2-3 line scripts importing TypeScript modules
- Depends on: Bun runtime, tool implementations in `tools/`
- Used by: Users, PATH-based invocation, install-tool.sh

**Hooks (`hooks/`):**
- Purpose: Claude Code integration via Stop/Start hooks
- Location: `/Users/pete/Projects/mr-tools/hooks/`
- Contains: Shell scripts triggered by Claude Code events
- Depends on: Installed binaries in `~/.local/bin/`
- Used by: Claude Code hook system

## Data Flow

**Secrets Retrieval:**

1. Tool calls `getSecret({ tool, key, env })`
2. Library checks environment variables (priority order)
3. Falls back to `~/.config/mr-tools/secrets.json`
4. Returns value or undefined

**Tool Invocation (via bin wrapper):**

1. User runs `grok "query"` from any directory
2. Bun executes `/Users/pete/Projects/mr-tools/bin/grok`
3. Wrapper imports `../tools/grok/grok.ts`
4. Tool parses args, loads secrets, calls external API
5. Output goes to stdout (text or JSON)

**Checkpoint Auto-Capture:**

1. Claude Code Stop hook triggers `hooks/auto-jump.sh`
2. Script extracts session/message IDs from transcript
3. Runs `checkpoint-auto-capture` binary in background
4. Binary generates AI label via Claude Agent SDK
5. Saves checkpoint to `.agent-checkpoints.json`

**State Management:**
- Secrets stored in `~/.config/mr-tools/secrets.json`
- OAuth tokens stored in `~/.config/tool-library/{tool}/token.json`
- Checkpoints stored in project-local `.agent-checkpoints.json`
- No global runtime state; each invocation is stateless

## Key Abstractions

**SecretLookup:**
- Purpose: Unified interface for retrieving API keys/tokens
- Examples: `lib/config.ts`
- Pattern: Environment vars take priority over config file

**Checkpoint:**
- Purpose: Point-in-time snapshot of Claude conversation
- Examples: `lib/checkpoint.ts`
- Pattern: Session + message ID enables temporal queries

**CLI Tool:**
- Purpose: Standalone executable with subcommands and flags
- Examples: `tools/gmail/gmail.ts`, `tools/grok/grok.ts`
- Pattern: `config show/set`, `--json` output, `--help` flag

**Workflow Tool:**
- Purpose: Focused wrapper around general tool for specific use case
- Examples: `workflows/email/gmail_clerk_pin.ts`
- Pattern: Hardcoded parameters, minimal flags, single output

## Entry Points

**User CLI (`bin/`):**
- Location: `/Users/pete/Projects/mr-tools/bin/{tool-name}`
- Triggers: User invocation from terminal
- Responsibilities: Import and execute tool implementation

**Tool Implementation (`tools/{tool}/`):**
- Location: `/Users/pete/Projects/mr-tools/tools/{tool-name}/{tool-name}.ts`
- Triggers: Import from bin wrapper
- Responsibilities: Parse args, call APIs, format output

**Hook Entry (`hooks/`):**
- Location: `/Users/pete/Projects/mr-tools/hooks/auto-jump.sh`
- Triggers: Claude Code Stop hook
- Responsibilities: Extract context, invoke checkpoint capture

**Installer (`install-tool.sh`):**
- Location: `/Users/pete/Projects/mr-tools/install-tool.sh`
- Triggers: Manual execution or build scripts
- Responsibilities: Move binaries to `~/.local/bin/`, update PATH

## Error Handling

**Strategy:** Fail fast with descriptive errors to stderr

**Patterns:**
- API errors: Print message and exit with code 1
- Missing config: Suggest specific `config set` command
- JSON output mode: Return `{"status": "error", "error": "..."}`
- Never swallow exceptions silently

## Cross-Cutting Concerns

**Logging:** Console output only; `--quiet` flag suppresses progress
**Validation:** Zod schemas for complex inputs (e.g., gpt-image-gen)
**Authentication:** Per-tool OAuth flows with local token storage

---

*Architecture analysis: 2026-01-19*
