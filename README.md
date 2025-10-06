# 🛠️ Mr Tools

**Centralized tooling and infrastructure for Captain32 and personal productivity.**

Mr Tools is a monorepo containing all CLI tools and MCP servers used across Pete's development workflow. Built with Bun for fast execution and easy maintenance.

## Architecture

```
mr-tools/
├── bin/                    # Executable entry points (~1KB each)
│   ├── gmail              # #!/usr/bin/env bun
│   ├── grok               # Runtime scripts (not compiled)
│   ├── gcal
│   └── ...
├── tools/                 # CLI tool sources
│   ├── gmail/
│   │   ├── gmail.ts       # Main implementation
│   │   ├── CLAUDE.md      # AI assistant docs
│   │   └── README.md      # Human docs
│   └── ...
├── mcps/                  # MCP server sources
│   └── (future MCPs here)
├── lib/                   # Shared utilities
│   └── config.ts          # Centralized secrets management
├── package.json           # Single dependency file for all tools
├── install-tool.sh        # Global installation script
├── CLAUDE.md              # Mr Tools AI documentation
└── README.md              # This file
```

## Why Runtime Scripts?

**Previous approach:** Each tool compiled to a 56MB binary (10 tools = 560MB)

**Current approach:** Tiny runtime scripts that execute instantly with Bun

**Benefits:**
- ✅ Small repo size (~5MB vs 560MB)
- ✅ Instant updates (edit → run, no compile)
- ✅ Shared dependencies (one node_modules)
- ✅ Same pattern for CLI tools and MCP servers
- ✅ Fast development iteration

## Installation

```bash
# Install dependencies
bun install

# Add bin/ to PATH
./install-tool.sh

# Or manually add to ~/.zshrc:
export PATH="/Users/pete/Projects/mr-tools/bin:$PATH"
```

## Available Tools

### Communication & Social
- **gmail** - Gmail management via OAuth
- **grok** - xAI Grok chat interface

### Calendar & Scheduling
- **cal-com** - Cal.com scheduling
- **gcal** / **google-calendar** - Google Calendar management

### Maps & Location
- **google-maps** - Google Maps API

### Image Generation
- **gpt-image-gen** - OpenAI image generation

### Content & Publishing
- **typefully** - Twitter/social posting

### Development
- **uploadthing** - File uploads
- **square** - Square payments

## Configuration

All tools use centralized secrets management at `~/.config/mr-tools/secrets.json`:

```bash
# Set API keys for tools
grok config set api-key "xai-..."
gmail config set client-id "..."
gmail config set client-secret "..."
google-maps config set api-key "..."
cal-com config set api-key "..."
gpt-image-gen config set api-key "sk-..."
```

Environment variables are also supported and take priority:
- `GROK_API_KEY`
- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`
- `GOOGLE_MAPS_API_KEY`
- `CALCOM_API_KEY`
- `OPENAI_API_KEY`

## Usage

All tools support `--help` and `--json` flags:

```bash
# Get help
gmail --help
grok --help

# Use tools
gmail list -n 10
grok "What are the latest trends on X?"
gcal list --from "2025-01-01" --to "2025-01-31"
google-maps geocode "1600 Amphitheatre Parkway"

# JSON output for scripting
gmail list --json | jq '.messages[0]'
cal-com bookings list --json
```

## Development

### Adding a New Tool

1. Create tool directory:
```bash
mkdir -p tools/my-tool
```

2. Create source file `tools/my-tool/my-tool.ts`:
```typescript
#!/usr/bin/env bun
import { getSecret, setSecret } from "../../lib/config";

// Your tool implementation
console.log("Hello from my-tool!");
```

3. Create bin entry point:
```bash
echo '#!/usr/bin/env bun\nimport "../tools/my-tool/my-tool.ts";' > bin/my-tool
chmod +x bin/my-tool
```

4. Test it:
```bash
./bin/my-tool
```

### Adding an MCP Server

Same pattern, but place in `mcps/` instead of `tools/`:

```bash
mkdir -p mcps/my-mcp
# Create mcps/my-mcp/my-mcp.ts
echo '#!/usr/bin/env bun\nimport "../mcps/my-mcp/my-mcp.ts";' > bin/mcp-my-mcp
chmod +x bin/mcp-my-mcp
```

## Team Context

**Mr. Tools** is the tooling specialist for the Captain32 team:
- **App Team** (captain32-mobile) - React Native/Expo
- **API Team** (captain32-api) - Cloudflare Workers
- **Agents Team** (captain32-agents) - AI agents service
- **Mr. Tools** (this repo) - Infrastructure & tooling

## Migration from tool-library

This repo replaces the old `tool-library` repo with a cleaner, more maintainable architecture. See CLAUDE.md for full details on the migration strategy.

## License

MIT
