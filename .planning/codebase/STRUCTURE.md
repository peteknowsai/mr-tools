# Codebase Structure

**Analysis Date:** 2026-01-19

## Directory Layout

```
mr-tools/
├── bin/                    # Thin wrapper scripts (invoke tools)
├── lib/                    # Shared TypeScript libraries
├── tools/                  # General CLI tools (multi-command)
│   ├── gmail/
│   ├── grok/
│   ├── gpt-image-gen/
│   ├── rewind/
│   ├── jump/
│   ├── slack-send/
│   ├── slack-read/
│   ├── slack-create-channel/
│   ├── nanobanana/
│   └── ...
├── workflows/              # Workflow-specific tools (single-purpose)
│   ├── auth/
│   ├── content/
│   ├── email/
│   └── scheduling/
├── hooks/                  # Claude Code hook scripts
├── node_modules/           # Dependencies (gitignored)
├── .planning/              # GSD planning documents
├── .claude/                # Claude Code project config
├── install-tool.sh         # Binary installation script
├── package.json            # Node dependencies
├── bun.lock                # Bun lockfile
├── CLAUDE.md               # Claude Code instructions
└── README.md               # Project documentation
```

## Directory Purposes

**`bin/`:**
- Purpose: Shell scripts that invoke tool implementations
- Contains: Tiny wrappers (2-3 lines each)
- Key files: `grok`, `gmail`, `gcal`, `gpt-image-gen`, `nanobanana`, `geminipro`
- Pattern: `#!/usr/bin/env bun` + `import "../tools/{name}/{name}.ts";`

**`lib/`:**
- Purpose: Shared utilities used by all tools
- Contains: TypeScript modules for common patterns
- Key files:
  - `config.ts`: Secrets management (read/write to `~/.config/mr-tools/secrets.json`)
  - `checkpoint.ts`: Checkpoint persistence for rewind/jump tools

**`tools/`:**
- Purpose: General CLI tools with multiple subcommands
- Contains: Self-contained tool directories
- Structure per tool:
  - `{tool-name}.ts`: Main entry point (or `{tool-name}.py` for Python)
  - `CLAUDE.md`: Tool-specific instructions for Claude
  - Additional modules as needed

**`workflows/`:**
- Purpose: Single-purpose tools for known agent patterns
- Contains: Focused scripts organized by domain
- Categories:
  - `auth/`: Authentication workflows (e.g., `clerk_verify_pin.ts`)
  - `content/`: Content creation (e.g., `generate_card_art.ts`)
  - `email/`: Email workflows (e.g., `gmail_clerk_pin.ts`)
  - `scheduling/`: Calendar workflows (e.g., `cal_today.ts`)

**`hooks/`:**
- Purpose: Claude Code integration scripts
- Contains: Shell scripts triggered by Claude Code events
- Key files: `auto-jump.sh` (Stop hook for auto-checkpointing)

## Key File Locations

**Entry Points:**
- `bin/grok`: Grok CLI wrapper
- `bin/gmail`: Gmail CLI wrapper
- `bin/gpt-image-gen`: GPT image generation wrapper
- `bin/nanobanana`: Gemini 3 Pro image generation wrapper
- `bin/geminipro`: Gemini 3 Pro text generation wrapper

**Configuration:**
- `package.json`: Node.js dependencies
- `~/.config/mr-tools/secrets.json`: API keys and tokens (runtime)
- `~/.config/tool-library/{tool}/token.json`: OAuth tokens (runtime)

**Core Logic:**
- `lib/config.ts`: Secrets management API
- `lib/checkpoint.ts`: Checkpoint save/load/query
- `tools/rewind/rewind.ts`: Session time-travel tool
- `tools/jump/jump.ts`: Label-based navigation tool

**Testing:**
- No formal test suite; tools tested manually via CLI

## Naming Conventions

**Files:**
- Tool directories: `kebab-case` (e.g., `gpt-image-gen`, `slack-send`)
- TypeScript modules: `kebab-case.ts` (e.g., `gmail.ts`, `grok.ts`)
- Python modules: `snake_case.py` (e.g., `nanobanana.py`)
- Workflow tools: `snake_case.ts` (e.g., `gmail_clerk_pin.ts`)
- Bin wrappers: `kebab-case` (no extension)

**Directories:**
- Tool categories: `kebab-case` (e.g., `gpt-image-gen`)
- Workflow categories: `kebab-case` (e.g., `content`, `email`)
- Config directories: `kebab-case` (e.g., `mr-tools`, `tool-library`)

## Where to Add New Code

**New General CLI Tool:**
1. Create directory: `tools/{tool-name}/`
2. Create main file: `tools/{tool-name}/{tool-name}.ts`
3. Create wrapper: `bin/{tool-name}` with `import "../tools/{tool-name}/{tool-name}.ts";`
4. Optionally add `CLAUDE.md` for tool instructions
5. Use `lib/config.ts` for secrets management

**New Workflow Tool:**
1. Identify category: `auth`, `content`, `email`, or `scheduling`
2. Create file: `workflows/{category}/{domain}_{action}.ts`
3. Follow pattern: `{domain}_{action}_{specifics}.ts`
4. Wrap existing general tool or call APIs directly

**New Shared Utility:**
- Add to `lib/` directory
- Export functions for use by tools
- Keep dependencies minimal (prefer Node.js built-ins)

**New Hook:**
- Add shell script to `hooks/`
- Register in `~/.claude/settings.json` under `hooks.Stop` or `hooks.Start`

**New Python Tool:**
1. Create directory: `tools/{tool-name}/`
2. Create `setup.sh` for venv creation
3. Create `{tool-name}.py` main script
4. Create bin wrapper that invokes Python via venv

## Special Directories

**`node_modules/`:**
- Purpose: npm/bun dependencies
- Generated: Yes (via `bun install`)
- Committed: No (gitignored)

**`.planning/`:**
- Purpose: GSD planning and codebase analysis documents
- Generated: Yes (by Claude Code)
- Committed: Yes

**`~/.local/bin/`:**
- Purpose: Global installation target for compiled binaries
- Generated: Yes (via `install-tool.sh`)
- Committed: No (outside repo)

**`~/.config/mr-tools/`:**
- Purpose: Runtime configuration and secrets
- Generated: Yes (by tools on first config)
- Committed: No (outside repo, contains secrets)

---

*Structure analysis: 2026-01-19*
