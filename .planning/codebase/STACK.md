# Technology Stack

**Analysis Date:** 2026-01-20

## Languages

**Primary:**
- TypeScript - Main language for CLI tools and libraries (`lib/*.ts`, `tools/**/*.ts`)

**Secondary:**
- Python 3.14 - Used for nanobanana/geminipro tools (`tools/nanobanana/*.py`)

## Runtime

**Environment:**
- Bun 1.3.4 - Primary runtime for TypeScript tools
- Python 3.14 - For Python-based tools (nanobanana venv)

**Package Manager:**
- npm (package.json present)
- Lockfile: bun.lockb (Bun binary lockfile)
- pip (for Python tools, uses requirements.txt)

## Frameworks

**Core:**
- None - Tools are standalone CLI scripts, no web framework

**CLI:**
- Commander.js 12.1.0 - CLI argument parsing
- Zod 4.1.12 - Runtime type validation and schemas

**AI/SDK:**
- `@anthropic-ai/claude-agent-sdk` 0.1.8 - Claude Agent SDK for checkpoint/query functionality
- `@anthropic-ai/sdk` 0.30.1 - Anthropic API SDK
- OpenAI 4.67.3 - GPT image generation
- Replicate 1.2.0 - AI model API client

**APIs:**
- googleapis 140.0.0 - Google Calendar, Gmail integration

## Key Dependencies

**Critical:**
- `@anthropic-ai/claude-agent-sdk` - Powers the rewind/jump checkpoint system
- `commander` - CLI framework used across all tools
- `zod` - Schema validation for tool inputs

**Infrastructure:**
- `googleapis` - Gmail and Google Calendar tools
- `openai` - GPT image generation tool
- `replicate` - Replicate AI image generation

**Python (nanobanana):**
- `gemini-webapi>=1.17.0` - Gemini 3 Pro web API access
- `httpx>=0.24.0` - Async HTTP client
- `browser-cookie3>=0.19.0` - Cookie extraction from Chrome
- `Pillow>=10.0.0` - Image processing

## Configuration

**Environment:**
- Centralized secrets at `~/.config/mr-tools/secrets.json`
- Environment variables take priority over config files
- Common vars: `GROK_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_MAPS_API_KEY`

**Build:**
- No build step for most tools - Bun runs TypeScript directly
- `bun build --compile` used for compiled binaries (installed to `~/.local/bin/`)

## Build Tools

**Compilation:**
- Bun's built-in compiler (`bun build --compile`) for single-file binaries
- TypeScript executed directly via Bun (no transpilation step)

**Pattern:**
- Source files: `tools/{tool-name}/{tool-name}.ts`
- Wrapper scripts in `bin/` that import source files
- Large compiled binaries go to `~/.local/bin/` (not in repo)

**Example wrapper (`bin/grok`):**
```typescript
#!/usr/bin/env bun
import "../tools/grok/grok.ts";
```

## Platform Requirements

**Development:**
- macOS (Darwin) - primary development environment
- Bun runtime installed globally
- Python 3.14+ for nanobanana tools

**Production:**
- CLI tools designed for local execution
- MCP servers run via Docker MCP Gateway or stdio
- No cloud deployment - tools are client-side

## Type Definitions

**Dev Dependencies:**
- `@types/node` 22.7.5 - Node.js type definitions
- `bun-types` 1.1.30 - Bun-specific type definitions

---

*Stack analysis: 2026-01-20*
