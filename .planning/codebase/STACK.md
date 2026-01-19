# Technology Stack

**Analysis Date:** 2026-01-19

## Languages

**Primary:**
- TypeScript - All CLI tools in `tools/` directory, library code in `lib/`
- JavaScript (ES Modules) - Package configured with `"type": "module"`

**Secondary:**
- Python 3 - `tools/nanobanana/nanobanana.py` (Gemini 3 Pro image generation)
- Bash - `install-tool.sh`, wrapper scripts in `bin/`

## Runtime

**Environment:**
- Bun 1.3.4 - Primary runtime for TypeScript tools
- Shebang pattern: `#!/usr/bin/env bun` in all `.ts` tools
- Python 3 - For nanobanana tool only

**Package Manager:**
- Bun (via `bun install`)
- Lockfile: `bun.lock` present

## Frameworks

**Core:**
- None (vanilla TypeScript/Bun for all tools)
- Each tool is standalone CLI, no shared framework

**SDK Integration:**
- `@anthropic-ai/claude-agent-sdk` ^0.1.8 - For rewind/jump session querying
- `@anthropic-ai/sdk` ^0.30.1 - Anthropic API access

**Build/Dev:**
- `bun build --compile` - Compiles to single-file binaries
- No transpilation step - Bun runs TypeScript directly
- Binaries moved to `~/.local/bin/` to prevent checkpoint bloat

## Key Dependencies

**Critical:**
- `commander` ^12.1.0 - CLI argument parsing (used in some tools)
- `googleapis` ^140.0.0 - Gmail and Google Calendar OAuth
- `openai` ^4.67.3 - GPT-Image-1 generation
- `replicate` ^1.2.0 - Replicate model API
- `zod` ^4.1.12 - Schema validation

**Infrastructure:**
- `@types/node` ^22.7.5 - Node.js type definitions
- `bun-types` ^1.1.30 - Bun runtime types

**Python (nanobanana):**
- `gemini-webapi` >=1.17.0 - Gemini authentication
- `httpx` >=0.24.0 - Async HTTP
- `browser-cookie3` >=0.19.0 - Chrome cookie extraction
- `orjson` >=3.9.0 - Fast JSON
- `Pillow` >=10.0.0 - Image processing

## Configuration

**Environment:**
- All secrets centralized in `~/.config/mr-tools/secrets.json`
- Environment variables take priority over config file
- Per-tool secret namespacing (e.g., `grok.api_key`, `google.client_id`)

**Key env vars:**
- `GROK_API_KEY` / `XAI_API_KEY` - xAI Grok access
- `OPENAI_API_KEY` - OpenAI GPT-Image-1
- `REPLICATE_API_KEY` / `REPLICATE_API_TOKEN` - Replicate
- `GOOGLE_MAPS_API_KEY` - Google Maps
- `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` - Gmail OAuth
- `GCAL_CLIENT_ID` / `GCAL_CLIENT_SECRET` - Calendar OAuth
- `SLACK_BOT_TOKEN` - Slack messaging
- `SQUARE_ACCESS_TOKEN` - Square payments
- `CALCOM_API_KEY` - Cal.com scheduling
- `TYPEFULLY_API_KEY` - Typefully social
- `UPLOADTHING_API_KEY` - File uploads

**Build:**
- No build config files (tsconfig, etc.)
- Bun handles TypeScript natively
- Compilation: `bun build ./tool.ts --compile --outfile ./bin/tool-name`

## Platform Requirements

**Development:**
- macOS (darwin) - Primary development platform
- Bun 1.3+ runtime
- Python 3.6+ (for nanobanana only)
- Chrome browser (for cookie extraction in nanobanana)

**Production:**
- Tools designed for local CLI use
- Compiled binaries are self-contained (~59MB each)
- No server deployment - all tools run locally

## Binary Management

**Compilation Pattern:**
```bash
bun build ./tools/tool-name/tool.ts --compile --outfile ./bin/tool-name
```

**Installation:**
- `./install-tool.sh <tool-name>` moves binary to `~/.local/bin/`
- Prevents Claude Code checkpoint bloat (binaries are ~59MB each)
- `~/.local/bin/` must be in PATH

**Wrapper Scripts:**
- Small bash wrappers in `bin/` (~50-100 bytes each)
- Pattern: `#!/bin/bash` + `bun run ./tools/tool-name/tool.ts "$@"`
- Large compiled binaries go to `~/.local/bin/`

## Tool Architecture Pattern

Each tool follows this pattern:
1. `#!/usr/bin/env bun` shebang
2. Import from `../../lib/config` for secrets
3. `parseArgs()` function for CLI parsing
4. `printHelp()` function for usage
5. `main()` async entry point
6. `config set/show` subcommand for secret management
7. `--json` flag for structured output

---

*Stack analysis: 2026-01-19*
