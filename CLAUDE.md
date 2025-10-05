# CLAUDE.md

This file provides guidance to Claude Code when working with MCP server installation, configuration, and testing.

## Repository Context

**mr-tool** (formerly mr-mcp) is Pete's tooling and infrastructure hub within the Captain32 workspace (`/Users/pete/Projects/`). This repo manages all development tools including:
- **MCP servers** - Model Context Protocol servers (primary focus)
- **CLI tools** - Command-line utilities and developer tools
- **System-wide tooling** - Available to all Claude Code instances (Pete + all teams)
- **Team-specific tools** - Per-project tools for Captain32 teams (mobile, API, agents)

## Captain32 Product Overview

**Captain32** is an AI-powered mobile app for boat captains. The core feature is daily personalized card compositions (Captain's Advisor) with interactive components.

**The Team Structure:**
- **Pete** - Product Manager (one human developer using Claude Code across all repos)
- **App Team** - React Native/Expo mobile app (`captain32-mobile`)
- **API Team** - Cloudflare Workers backend (`captain32-api`)
- **Agents Team** - AI agents service (`captain32-agents`)
- **Mr. Tool (Me)** - Tooling & infrastructure specialist (`mr-tool`)

**My Role on the Captain32 Team:**

I'm the **tooling and infrastructure specialist** supporting Pete and all three development teams. While I may help with other projects, my primary focus is enabling the Captain32 product teams with the best tools available.

**What I do:**
1. **Research tools** - Find the best MCP servers, CLI tools, and utilities for team needs
2. **Install & configure** - Set up tools system-wide or per-team, handle dependencies
3. **Troubleshoot issues** - Fix configuration problems, resolve version conflicts
4. **Test before deployment** - Verify tools work before teams use them
5. **Document usage** - Create guides, update team CLAUDE.md files with tool instructions
6. **Keep tools updated** - Ensure teams have latest CLIs, check for version updates
7. **Support workflows** - Help teams integrate tools into their development cycles

**Types of tools I manage:**
- **MCP servers** - Chrome DevTools, Docker MCP Toolkit, GitHub, databases, etc.
- **CLI tools** - Docker CLI, wrangler, expo-cli, npm/bun, git, etc.
- **Development utilities** - Testing frameworks, build tools, debugging tools
- **Infrastructure** - Container management, deployment tools, CI/CD

**How I work with other teams:**
- **App Team**: Browser automation (Chrome MCP), Expo CLI, mobile dev tools, testing utilities
- **API Team**: Docker CLI, wrangler CLI, database MCPs, Cloudflare tooling, API testing tools
- **Agents Team**: Claude SDK, MCP servers for research, AI service integrations
- **Pete**: System-wide productivity tools (GitHub MCP, Slack, etc.), latest CLIs

## MCP Architecture Overview

### Transport Types

**stdio (Standard Input/Output)** - Local process
- Server runs as subprocess when needed
- Most common for local development
- Example: Chrome DevTools MCP, Filesystem MCP
- Config: `{ "command": "npx", "args": ["server-name"] }`

**SSE (Server-Sent Events)** - DEPRECATED
- Being replaced by Streamable HTTP
- Don't use for new servers

**Streamable HTTP** - Network-based
- Server runs independently (local or remote)
- Supports multiple clients
- Example: Replicate MCP
- Config: `{ "type": "streamableHttp", "url": "http://..." }`

### Installation Scopes

**System-wide (User scope)**:
- Config location: `~/.claude.json` under `mcpServers`
- Available to ALL Claude Code instances
- Use for: Common tools Pete needs everywhere (Chrome, filesystem, etc.)

**Project-specific**:
- Config location: `<project>/.claude/mcp_config.json`
- Available only in that project
- Use for: Team-specific tools (database MCP for API team only)

## Installed MCP Servers

### Chrome DevTools MCP (System-wide)

**Purpose**: Browser automation, debugging, testing web apps

**Configuration**:
```json
{
  "chrome-devtools": {
    "type": "stdio",
    "command": "npx",
    "args": [
      "chrome-devtools-mcp@latest",
      "--isolated=true"
    ],
    "env": {}
  }
}
```

**Key flags**:
- `--isolated=true` - Creates temporary profile per session (prevents conflicts)
- `--headless=true` - Run without UI (optional)
- `--channel=canary` - Use Chrome Canary instead of stable (optional)

**Available tools** (prefix: `mcp__chrome-devtools__`):
- `list_console_messages` - View console logs/errors
- `list_network_requests` - Monitor API calls
- `get_network_request` - Inspect specific request
- `take_snapshot` - DOM snapshot with UIDs
- `take_screenshot` - Capture page visually
- `navigate_page` - Go to URL
- `list_pages` / `select_page` / `close_page` - Tab management
- `click` / `fill` / `fill_form` - User interactions
- `wait_for` - Wait for text to appear
- `evaluate_script` - Run JavaScript in page
- `performance_start_trace` / `performance_stop_trace` - Performance profiling
- `performance_analyze_insight` - Deep-dive metrics
- `emulate_network` / `emulate_cpu` - Throttling simulation

### Replicate MCP (System-wide)

**Purpose**: AI image generation

**Configuration**:
```json
{
  "replicate": {
    "type": "sse",
    "url": "https://mcp.replicate.com/sse"
  }
}
```

**Status**: Needs authentication (not yet configured)

## Testing MCP Servers

### CLI Commands

```bash
# List all configured servers
claude mcp list

# Get details for specific server
claude mcp get <server-name>

# Add server (user scope)
claude mcp add <name> <command> <args...> --scope user

# Remove server
claude mcp remove <server-name>
```

### Testing Chrome DevTools MCP

**Basic test pattern**:
```javascript
1. list_pages → Check browser launched
2. navigate_page(url: "https://example.com") → Load page
3. take_screenshot → Verify rendering
4. list_console_messages → Check for errors
5. evaluate_script(() => document.title) → Test JS execution
```

**Common debugging patterns** (generalized from App Team):

**Pattern 1: Testing Web App Endpoints**
```javascript
1. navigate_page(url: "http://localhost:8787/api/health")
2. list_console_messages → Check for errors
3. take_screenshot → Document response
4. list_network_requests → Verify API calls
```

**Pattern 2: Debugging UI Issues**
```javascript
1. navigate_page(url: "http://localhost:3000")
2. take_snapshot → Get element UIDs
3. click(uid: "button-123") → Trigger interaction
4. list_console_messages → Check for errors
5. list_network_requests → Verify backend calls
6. screenshot → Document state
```

**Pattern 3: Performance Testing**
```javascript
1. performance_start_trace(reload: true, autoStop: true)
2. wait_for(text: "Page loaded")
3. performance_stop_trace → Get metrics
4. performance_analyze_insight(insightName: "LCPBreakdown")
5. Document findings
```

## Common Issues & Solutions

### Issue: "Browser already running" Error

**Symptom**: Multiple Chrome instances conflict
**Solution**: Add `--isolated=true` flag to config
**Why**: Creates temporary profiles per session instead of shared profile

### Issue: MCP Server Not Showing in Tools

**Symptom**: Tools not available after config change
**Solution**: Restart Claude Code completely (not just session)
**Why**: MCP servers load on startup

### Issue: Chrome MCP Launches Multiple Instances

**Symptom**: Multiple browsers open for different projects
**Solution**: This is expected with `--isolated=true` (feature, not bug)
**Why**: Each Claude instance gets isolated browser for safety

## Installation Workflow

When Pete asks to install an MCP server:

1. **Research the server**:
   - Search for official docs, GitHub repo
   - Understand transport type (stdio vs HTTP)
   - Check for required environment variables
   - Note any special flags needed

2. **Determine scope**:
   - Ask: "System-wide or team-specific?"
   - System-wide: For Pete + all teams
   - Team-specific: For one Captain32 team only

3. **Install & configure**:
   - Use `claude mcp add` for stdio servers
   - Manually edit `~/.claude.json` for complex configs
   - Add any required env vars or flags

4. **Test the installation**:
   - Run `claude mcp list` to verify
   - Try basic tool usage to confirm
   - Document any issues found

5. **Document in mr-mcp**:
   - Update this CLAUDE.md with server details
   - Note configuration, tools, common patterns

## Team Communication & Coordination

### How the Teams Work Together

This project has **one developer (Pete)** using **Claude Code** across four separate repos:
- **captain32-mobile** - App Team Claude
- **captain32-api** - API Team Claude
- **captain32-agents** - Agents Team Claude
- **mr-mcp** (this repo) - Mr. MCP Claude (me)

Each repo has a dedicated Claude instance that knows its codebase deeply. Teams communicate through Pete by passing messages.

### Communication Pattern

**When I need something from another team:**
```
"Message to App Team: Chrome MCP is installed system-wide. Restart Claude Code to access tools."
"Message to API Team: Do you need a D1 database MCP for local testing?"
```

Pete copies this to the other repo, gets a response, and brings it back.

**When I receive messages:**
```
"Message from App Team: Chrome MCP giving 'browser already running' error"
"Message from API Team: We need PostgreSQL MCP for debugging migrations"
```

### What Each Team Does

**Mr. MCP (Me):**
- MCP server installation and configuration
- Troubleshooting MCP issues across all teams
- Testing MCP servers before teams use them
- Documentation and best practices
- System-wide tooling for Pete + all teams

**App Team (captain32-mobile):**
- React Native/Expo mobile app
- **Owns `@peteknowsai/types` package** - Defines card interfaces
- Uses Chrome MCP for autonomous web debugging
- Card component library and UI

**API Team (captain32-api):**
- Cloudflare Workers backend (Hono framework)
- Data storage (D1 SQLite, R2 object storage)
- Orchestration between mobile and agents
- User authentication (Clerk JWT)

**Agents Team (captain32-agents):**
- AI agents service (localhost:3000 in dev)
- Generates personalized daily card compositions
- Adaptive onboarding strategies
- Creative control over content and art generation

**Pete (Product Manager):**
- Coordinates all teams
- Makes product decisions
- Passes messages between teams
- Uses system-wide MCP tools for productivity

### Captain32 Teams Using MCP

**App Team (captain32-mobile):**
- **Currently using**: Chrome DevTools MCP (system-wide)
- **Use cases**: Debugging Expo web builds, testing card rendering, verifying API integration, autonomous development cycle
- **Pattern**: Write code → verify with Chrome MCP → iterate without Pete

**API Team (captain32-api):**
- **Potential needs**: Database MCP (D1/SQLite), R2 storage MCP, Cloudflare Workers debugging tools
- **Use cases**: Debugging SQL queries, testing worker endpoints, inspecting D1 data

**Agents Team (captain32-agents):**
- **Potential needs**: Custom research MCPs, data source integrations, API testing tools
- **Use cases**: Testing agent endpoints, debugging composition generation, researching user data

**Pete (System-wide):**
- **Currently using**: Chrome DevTools MCP, Replicate MCP (needs auth)
- **Potential needs**: GitHub MCP, Slack MCP, Linear MCP, Filesystem MCP

## Best Practices

**When to use Chrome MCP**:
- ✅ Debugging web apps (frontends, APIs returning HTML)
- ✅ Testing browser-based features
- ✅ Verifying network requests/responses
- ✅ Performance profiling
- ✅ Autonomous verification without asking Pete

**When NOT to use Chrome MCP**:
- ❌ Native mobile features (use simulators)
- ❌ Backend-only APIs (use curl/Bash instead)
- ❌ File operations (use Read/Write tools)

**MCP vs Native Tools**:
- Use **Chrome MCP** when you need browser context (DOM, console, network)
- Use **Bash/Read/Write** for file operations, CLI commands
- Use **WebFetch** for simple HTTP requests without browser context

## Development Commands

```bash
# Initialize git repo (if needed)
git init

# Document new MCP server
# (Update this CLAUDE.md file)

# Test MCP server availability
claude mcp list

# Verify Chrome MCP works
# (Use tools in Claude Code session)
```

## Integration with Captain32 Teams

When teams report MCP issues:
1. **Reproduce the issue** - Test with same config
2. **Check logs** - Use `claude mcp get <server>`
3. **Fix configuration** - Update flags, env vars
4. **Test fix** - Verify tools work
5. **Document solution** - Update this file

## Future MCP Servers to Consider

- **GitHub MCP** - Repository management, PR reviews
- **Filesystem MCP** - Advanced file operations
- **PostgreSQL MCP** - Database debugging (for API team)
- **Slack MCP** - Team notifications
- **Linear MCP** - Issue tracking integration

## Notes

- **Package manager**: This repo doesn't need one (just config/docs)
- **Git**: Initialize if documenting complex setups
- **Testing**: Always test MCP servers after installation before recommending to teams
