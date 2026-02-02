# CLAUDE.md

This file provides guidance to Claude Code when working with MCP server installation, configuration, and testing.

## Captain32 Context

**See `~/.claude/captain32.md` for shared Captain32 project context**, including:
- What Captain32 is (product overview)
- Team structure and communication patterns
- What each team does (including Mr. Tools)
- Shared types package and technical stack

## Repository Context

**mr-tools** (formerly mr-mcp) is Pete's tooling and infrastructure hub within the Captain32 workspace (`/Users/pete/Projects/`). This repo manages all development tools including:
- **MCP servers** - Model Context Protocol servers (primary focus)
- **CLI tools** - Command-line utilities and developer tools
- **System-wide tooling** - Available to all Claude Code instances (Pete + all teams)
- **Team-specific tools** - Per-project tools for Captain32 teams (mobile, API, agents)

## Mr. Tools Role

I'm the **tooling and infrastructure specialist** supporting Pete and all Captain32 development teams. While I may help with other projects, my primary focus is enabling the Captain32 product teams with the best tools available.

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
- Use for: Common tools Pete needs everywhere

**Project-specific**:
- Config location: `<project>/.claude/mcp_config.json`
- Available only in that project
- Use for: Team-specific tools (database MCP for API team only)

### Installation Strategy by Purpose

**Production Agent MCPs → Docker MCP Gateway:**
- **When**: Building agents with Agent SDK that need MCPs in production
- **How**: Enable MCP servers on Docker MCP Gateway
- **Architecture**: Gateway = shared toolbox, agents get explicit keys (tool permissions)
- **Benefit**: Same setup dev to production, centralized tool management

```bash
# Add MCP server to gateway (makes it available in the library)
docker mcp server enable weather
docker mcp server enable database

# In Agent SDK config - explicitly grant agent access
agent.tools = [
  "mcp__weather",     // This agent has the "key" to use weather
  "mcp__database"     // This agent has the "key" to use database
]
```

**Key concept**: Just because an MCP is enabled on the gateway doesn't mean all agents can use it. Each agent must be explicitly configured with the tools it's allowed to access.

**Development Tooling MCPs → Compiled Binaries (stdio):**
- **When**: Local development tools for Claude Code sessions (debugging, testing, file ops)
- **How**: Compile to binaries in `mr-tools`, install globally via `install-tool.sh`
- **Scope options**:
  - **System-wide** (`~/.claude.json`): Pete uses across all projects
  - **Project-specific** (`.claude/mcp_config.json`): Only in that project
- **Benefit**: Fast startup, offline support, version controlled, consistent with CLI tools

**Installation workflow:**
```bash
# 1. Create MCP wrapper in mr-tools
cd ~/Projects/mr-tools
mkdir -p mcps
cat > mcps/postgres-mcp.ts << 'EOF'
#!/usr/bin/env bun
import { spawn } from 'bun';
// Wrapper or direct implementation
EOF

# 2. Compile to binary
bun build ./mcps/postgres-mcp.ts --compile --outfile ./bin/mcp-postgres

# 3. Install globally (optional, for system-wide access)
./install-tool.sh mcp-postgres
```

**Example system-wide config:**
```json
// ~/.claude.json
{
  "mcpServers": {
    "MCP_DOCKER": {
      "command": "docker",
      "args": ["mcp", "gateway", "run"]
    },
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest", "--isolated=true"]
    },
    "postgres": {
      "command": "mcp-postgres",
      "env": {
        "POSTGRES_URL": "postgresql://..."
      }
    }
  }
}
```

**Example project-specific config:**
```json
// captain32-api/.claude/mcp_config.json
{
  "mcpServers": {
    "postgres": {
      "command": "/Users/pete/Projects/mr-tools/bin/mcp-postgres",
      "env": {
        "POSTGRES_URL": "postgresql://..."
      }
    }
  }
}
```

**Note**: Use `npx` for quick testing or one-off MCPs. Prefer compiled binaries for frequently used tools.

### Docker MCP Gateway Architecture

**Docker MCP Gateway (production agent infrastructure):**
- Centralized tool library for all agents
- Single endpoint, multiple MCP servers behind it
- Agents connect to gateway, explicitly configured with allowed tools
- Secure, isolated, containerized
- Same setup works in dev and production

```
Docker MCP Gateway (Shared Library)
├── Weather MCP
├── Database MCP
├── Research MCP
└── Email MCP

Agent 1 → Gateway (allowed: weather, database)
Agent 2 → Gateway (allowed: email, database)
Agent 3 → Gateway (allowed: research, database)
```

**Managing the gateway:**
```bash
# View available servers
docker mcp catalog show docker-mcp

# Enable MCP server (adds to library)
docker mcp server enable postgres

# Disable when not needed
docker mcp server disable postgres
```

## Installed MCP Servers

### Docker MCP Toolkit (System-wide)

**Purpose**: Docker Hub management, container operations, Cloudflare docs search

**Installation method**: System-wide via Docker MCP gateway
**Why Docker gateway**: Provides multiple tools through single connection, easy updates

**Configuration**:
```json
{
  "MCP_DOCKER": {
    "type": "stdio",
    "command": "docker",
    "args": ["mcp", "gateway", "run"]
  }
}
```

**Available tools** (prefix: `mcp__MCP_DOCKER__`):
- **Docker Hub Operations**:
  - `search` - Find Docker images
  - `getRepositoryInfo` / `listRepositoriesByNamespace` - Repository management
  - `createRepository` / `updateRepositoryInfo` - Repository CRUD
  - `listRepositoryTags` / `getRepositoryTag` - Tag management
  - `listNamespaces` / `listAllNamespacesMemberOf` - Namespace operations
  - `dockerHardenedImages` - Browse Docker Hardened Images (DHI)
- **Docker CLI**:
  - `docker` - Direct Docker command execution
- **Documentation**:
  - `search_cloudflare_documentation` - Search Cloudflare docs (Workers, Pages, D1, etc.)
  - `migrate_pages_to_workers_guide` - Migration documentation

**Use cases**:
- Pete exploring available Docker images
- API team researching Cloudflare Workers/D1 docs
- Managing container registries and images

### Chrome DevTools MCP (System-wide)

**Purpose**: Browser automation, debugging, testing web apps

**Installation method**: Individual (requires `--isolated=true` flag)
**Why individual**: Needs special flag for process isolation Docker can't provide

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

**Use cases**:
- App team: Autonomous web debugging, testing Expo builds
- API team: Testing worker endpoints in browser
- Pete: General web app debugging

### Replicate MCP (System-wide)

**Purpose**: AI image generation

**Installation method**: SSE (deprecated transport - consider replacing)

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
   - **System-wide**: For Pete + all teams
   - **Team-specific**: For one Captain32 team only

3. **Choose installation method**:

   **For system-wide MCPs:**
   - ✅ **Prefer Docker MCP gateway** (default choice)
   - ❌ **Use individual installation only if:**
     - Requires special flags (e.g., `--isolated=true`)
     - Needs custom env vars Docker can't pass
     - Performance critical (bypass gateway)
     - Not available through Docker MCP

   **For team-specific MCPs:**
   - ✅ **Always install individually**
   - Each team gets their own config file
   - Better isolation and lighter context

4. **Install & configure**:
   - **Docker gateway**: Already configured, just verify with `claude mcp list`
   - **Individual stdio**: Use `claude mcp add <name> <command> <args...> --scope user/project`
   - **Manual config**: Edit `~/.claude.json` (system) or `<project>/.claude/mcp_config.json` (team)

5. **Test the installation**:
   - Run `claude mcp list` to verify connection
   - Try basic tool usage to confirm functionality
   - Document any issues found

6. **Document in mr-tools**:
   - Update this CLAUDE.md with server details
   - Note: Installation method, configuration, tools, use cases
   - Add to appropriate section (system-wide vs team-specific)

## Tool Support for Captain32 Teams

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

## Checkpoint System & Rewind Tool

### What is the Checkpoint System?

The checkpoint system allows multi-step agents (like Captain's Advisor) to **save conversation state** at critical points during execution. This enables **temporal inspection** - querying an agent at any specific point in its conversation history.

**Key concept**: In Claude Agent SDK, sessions have many sequential messages. Checkpoints save message IDs, letting you use `resumeSessionAt` to "rewind" the conversation to that exact point.

### The Rewind Tool

**`rewind`** - Time machine for Claude Code sessions (globally installed CLI)

**Purpose**: Query agents at specific checkpoints to verify outputs, debug workflows, or understand agent evolution.

**Usage**:
```bash
# List all checkpoints for current session
rewind list

# Get auto-summary of a checkpoint
rewind day2 memory

# Query at specific checkpoint (point-in-time mode)
rewind day2 memory "what did you learn?"

# Query with full context (agent sees future messages)
rewind day2 memory "why did you choose this?" --full

# Query all checkpoints with same question
rewind all "what composition did you generate?"
```

**Session inference**:
- Looks for `.agent-checkpoints.json` in current directory
- Uses most recent session by default
- Override with: `rewind -s SESSION_ID ...`

### Two Query Modes

**1. Point-in-Time (default)**:
- Uses `resumeSessionAt: messageId`
- Agent only sees conversation up to checkpoint
- Perfect for: Verifying "what did you generate at this step?"
- Prevents future context from contaminating answers

**2. Full Context (`--full` flag)**:
- Uses `resume: sessionId` without limit
- Agent sees entire session history
- Perfect for: Understanding "why did you make this choice?"
- Provides hindsight for reasoning questions

### For Projects: Saving Checkpoints

Projects using multi-step agents should save checkpoints using the `@mr-tools/checkpoint` helper library:

**Location**: `/Users/pete/Projects/mr-tools/lib/checkpoint.ts`

**Usage in agent workflows**:
```typescript
import { saveCheckpoint } from '@mr-tools/checkpoint';

// After agent generates response in a step
for await (const message of response) {
  if (message.type === 'assistant' && message.message?.id) {
    saveCheckpoint({
      sessionId: 'abc-123',
      userId: 'user_001',
      dayNumber: 2,
      step: 'composition',        // Human-readable step ID
      stepName: 'Daily Composition Generation',
      messageId: message.message.id
    });
  }
}
```

**Checkpoint file format** (`.agent-checkpoints.json`):
```json
{
  "SESSION_ID": {
    "sessionId": "abc-123",
    "userId": "user_001",
    "createdAt": "2025-10-06T08:27:49.431Z",
    "checkpoints": [
      {
        "dayNumber": 1,
        "step": "composition",
        "stepName": "Daily Composition Generation",
        "messageId": "msg_014WMSUXGdWkAexSSKSztcVf",
        "timestamp": "2025-10-06T08:27:49.433Z"
      }
    ]
  }
}
```

### Use Cases

**Agents Team (captain32-agents)**:
- Verify composition generation at each day
- Debug memory updates and prompt evolution
- Test planning outputs for next day
- Automated testing of multi-day workflows

**Any Claude Agent SDK Project**:
- Multi-day autonomous agents
- Chain-of-thought reasoning systems
- Research agents with sequential analysis
- Code generation with iterative refinement
- Testing frameworks with checkpoint verification

### Technical Details

**Binary location**: `/Users/pete/Projects/mr-tools/bin/rewind` (59MB)
**Global installation**:
- Primary: Symlinked to `/Users/pete/.local/bin/rewind` (works in all Claude Code sessions)
- Fallback: Available via `install-tool.sh rewind` (adds to PATH in shell configs)

**Dependencies**:
- `@anthropic-ai/claude-agent-sdk` - For query() and session management
- Claude Code executable at `/Users/pete/.claude/local/claude`

**PATH Notes**:
- `.local/bin` is in PATH for Claude Code sessions (preferred method)
- `mr-tools/bin` requires sourcing `~/.zshrc` (works in terminal sessions)
- If `rewind` command not found, use full path: `/Users/pete/Projects/mr-tools/bin/rewind`

**Step name mapping**: Supports both numeric (1,2,3,4) and string identifiers:
- 1 / "composition" → Composition step
- 2 / "memory" → Memory update step
- 3 / "system" → System prompt evolution
- 4 / "planning" → Planning step

### Message to Agent Team

**🎉 Your time machine is ready!** The `rewind` tool is now globally available and fully tested with your session `05772bad-fcb3-44aa-86ad-1a97118fccc6`.

#### What This Tool Does For You

The `rewind` tool solves a critical problem you've had: **How do you verify what the agent generated at a specific step without future context contaminating the answer?**

Before `rewind`:
- Resuming a session loads ALL messages → Agent sees everything that happened after
- Can't isolate "what did you generate on Day 2, Step 1?" without Day 3 influencing the answer
- Manual session interaction required for verification

After `rewind`:
- Query agent at exact checkpoint → Only sees messages up to that point
- Perfect isolation for verification: "Show me the Day 2 composition you generated"
- Automated testing possible: Run queries against all checkpoints programmatically

#### How Your Checkpoints Work

**Your current setup (already working)**:
- You save checkpoints with numeric steps: 1, 2, 3, 4
- File location: `.agent-checkpoints.json` in captain32-agents directory
- Each checkpoint saves: day number, step number, step name, message ID

**What `rewind` adds**:
- Converts numeric steps to readable names automatically:
  - Step 1 → "composition"
  - Step 2 → "memory"
  - Step 3 → "system"
  - Step 4 → "planning"
- Works from any directory with `.agent-checkpoints.json`
- Auto-detects most recent session (no need to type session ID)

#### The Two Query Modes (Important!)

**1. Point-in-Time Mode (default)** - Use this for verification:
```bash
rewind day2 composition "what composition did you generate?"
```
- Agent ONLY sees messages up to that checkpoint
- Perfect for: "Show me what you generated at this step"
- Use when: Testing outputs, verifying step results, debugging specific steps

**2. Full Context Mode (`--full`)** - Use this for reasoning:
```bash
rewind day2 composition "why did you choose this approach?" --full
```
- Agent sees ENTIRE session history (including future messages)
- Perfect for: "Why did you make this decision?" (needs hindsight)
- Use when: Understanding evolution, analyzing choices, debugging logic

**Key difference**: Point-in-time = "What happened?" vs Full context = "Why did it happen?"

#### Practical Usage Patterns

**Pattern 1: Daily Verification**
```bash
# After Day 2 completes, verify each step
rewind day2 composition    # Auto-summary of what was generated
rewind day2 memory        # Auto-summary of memory updates
rewind day2 system        # Auto-summary of system changes
rewind day2 planning      # Auto-summary of planning output
```

**Pattern 2: Debugging a Specific Step**
```bash
# Day 3 composition looks wrong? Check what happened:
rewind day3 composition "what composition did you generate?"
rewind day3 composition "what data did you use?" --full
rewind day2 planning "what did you plan for day 3?"  # Check previous planning
```

**Pattern 3: Understanding Evolution**
```bash
# How did the agent evolve over time?
rewind all "what was your system prompt?"
rewind all "what composition did you generate?"
rewind all "what did you learn?"
```

**Pattern 4: Automated Testing** (Future Enhancement)
```bash
# Script to verify all compositions
for day in 1 2 3; do
  rewind day${day} composition "list all card types you generated" > day${day}_cards.txt
done
```

#### Your Current Workflow (No Changes Needed!)

**Keep doing exactly what you're doing**:
```typescript
// In your multi-step workflow
for await (const message of response) {
  if (message.type === 'assistant' && message.message?.id) {
    saveCheckpoint({
      sessionId,
      userId,
      dayNumber,
      step: stepNumber,  // 1, 2, 3, or 4 - rewind handles conversion
      stepName,
      messageId: message.message.id
    });
  }
}
```

**The `rewind` tool automatically**:
- Finds your `.agent-checkpoints.json` file
- Detects the most recent session
- Converts numeric steps to readable names
- Provides clean query interface

#### Troubleshooting

**"No checkpoints found"** → Make sure you're in a directory with `.agent-checkpoints.json`
```bash
cd /Users/pete/Projects/captain32-agents  # Your checkpoint file is here
rewind list
```

**"No checkpoint found for Day X, step Y"** → Check available checkpoints first:
```bash
rewind list  # See all saved checkpoints
```

**"Claude Code process exited with code 1"** → Session might be corrupted or message ID invalid. This is rare but can happen if session data is missing.

**Want to query a different session?** → Use `-s` flag:
```bash
rewind -s 7bdaf411-96b2-4933-95fd-7a33933c9b88 list
```

#### Testing It Right Now

Your session `05772bad-fcb3-44aa-86ad-1a97118fccc6` has 4 days of checkpoints. Try these:

```bash
cd /Users/pete/Projects/captain32-agents

# See everything
rewind list

# Check Day 1 composition (point-in-time - what was generated)
rewind day1 composition

# Check Day 1 composition (full context - understand why)
rewind day1 composition "why did you generate this composition?" --full

# Compare compositions across days
rewind all "what composition did you generate?"
```

#### Integration Ideas

**For Testing Workflows**:
- Create test script that queries all checkpoints and validates outputs
- Compare composition structures across days
- Verify memory persistence between steps

**For Debugging**:
- When composition looks wrong, rewind to that step and query with point-in-time
- Check previous planning step to see what was intended
- Use full-context mode to understand reasoning

**For Analysis**:
- Track how agent's approach evolves over days
- Understand decision-making by comparing point-in-time vs full-context answers
- Build reports from checkpoint data

#### Summary

**What you need to know**:
1. Tool is installed globally as `rewind` command
2. Works with your existing checkpoint files (no changes needed)
3. Use point-in-time mode (default) for verification
4. Use full-context mode (`--full`) for reasoning
5. Session auto-detection means less typing

**What you get**:
- Temporal inspection of agent state at any checkpoint
- Isolated verification without future contamination
- Automated testing capabilities
- Better debugging and analysis tools

**Next action**: Try `rewind list` in your captain32-agents directory and explore your checkpoints!

## Jump System - Universal Auto-Labeled Navigation

### What is Jump?

`jump` is an automatic checkpoint system that captures **every assistant response** with an **AI-generated label**. Unlike `rewind` which requires manual checkpoint saving, `jump` works automatically via hooks.

**Key difference**:
- **`rewind`** - Domain-specific, manual checkpoints (e.g., "day2 memory", "day3 composition")
- **`jump`** - Universal, auto-captured with AI labels (e.g., "Fixed JWT validation bug")

Both tools use the **same registry** (`.agent-checkpoints.json`) and work together seamlessly.

### How It Works

1. **Hook triggers** - After every Claude response (Stop hook)
2. **AI generates label** - Sonnet 4.5 reads last 5 messages, creates 5-10 word label
3. **Saves to registry** - Uses same `saveCheckpoint()` as `rewind`
4. **Navigate anytime** - `jump "label"` to time travel

### Installation

**Already installed if you set up rewind!** The unified checkpoint system means:
- ✅ `checkpoint-auto-capture` - Binary at `~/.local/bin`
- ✅ `jump` - Binary at `~/.local/bin`
- ✅ Hook script - `~/.claude/hooks/auto-jump.sh`

**To enable auto-capture**, add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/auto-jump.sh"
          }
        ]
      }
    ]
  }
}
```

### Usage

```bash
# List all auto-captured jumps
jump list

# Search jumps
jump search "auth"
jump search "bug fix"

# Jump to a labeled point (partial match)
jump "Fixed JWT"                         # Uses default question (point-in-time)
jump "Fixed JWT" "how did you fix it?"   # Custom question (point-in-time)
jump "Fixed JWT" "why this approach?" --full  # Full context mode
jump auto_1728210000                     # By jump ID

# Works alongside rewind
rewind day2 memory                       # Explicit checkpoint
jump "Generated 7 cards"                 # Auto-captured jump
```

### Query Modes

**Point-in-Time (default)**:
- Agent only sees conversation up to the checkpoint
- Uses `resumeSessionAt` to limit context
- Perfect for: "What did you generate?" or "What happened at this step?"

**Full Context (`--full` flag)**:
- Agent sees entire session including future messages
- No `resumeSessionAt` limit (sees all history)
- Perfect for: "Why did you choose this approach?" or "What happened after this?"

**Example comparison**:
```bash
# Point-in-time: What was done at this moment?
jump "setup complete" "what did you build?"

# Full context: Understanding with hindsight
jump "setup complete" "why did you build it this way?" --full
```

### Registry Format (Unified with Rewind)

```json
{
  "SESSION_ID": {
    "sessionId": "abc-123",
    "userId": "test_user",
    "createdAt": "2025-10-06T10:00:00Z",
    "checkpoints": [
      // Manual checkpoint (rewind)
      {
        "dayNumber": 1,
        "step": "composition",
        "stepName": "Daily Composition Generation",
        "messageId": "msg_001",
        "timestamp": "2025-10-06T10:00:00Z"
      },
      // Auto-captured jump
      {
        "dayNumber": 0,
        "step": "auto_1728210000",
        "stepName": "Fixed JWT validation bug in auth middleware",
        "messageId": "msg_002",
        "timestamp": "2025-10-06T10:15:00Z",
        "auto": true
      }
    ]
  }
}
```

### Use Cases

**For any project** (not just Captain32):
- Debug sessions: "Jump back to when I fixed that bug"
- Review work: "What did I accomplish today?"
- Share context: "Here's where I added the auth feature"
- Learn patterns: "How did I solve similar problems?"

**For Captain32 agents** (with both systems):
- Explicit checkpoints: `rewind day2 memory`
- Auto jumps: `jump "Generated composition for Sea Breeze"`
- Best of both worlds!

### Technical Details

**Hook:** `~/.claude/hooks/auto-jump.sh`
- Runs after every assistant response (Stop hook)
- Extracts session ID and message ID from transcript
- Calls `checkpoint-auto-capture` in background (non-blocking)

**AI Labeling:**
- Model: Sonnet 4.5
- Context: Last 5 messages (~1500 tokens)
- Output: 5-10 word label (50 tokens)
- Cost: ~$0.01 per label
- Runs in background, doesn't block Claude

**Library:** `lib/checkpoint.ts`
- `saveAutoCheckpoint()` - Generates AI label, saves checkpoint
- `findCheckpointByLabel()` - Search by partial match
- `getAutoCheckpoints()` - Filter auto-captured only
- Shared with `rewind` tool

### Benefits

✅ **Zero configuration** - Works automatically once hook is enabled
✅ **AI-powered labels** - Meaningful descriptions, not "message 42"
✅ **Universal** - Works in any project, any session
✅ **Searchable** - Find by label or keyword
✅ **Two query modes** - Point-in-time (isolated) or full context (with hindsight)
✅ **Compatible** - Works alongside `rewind`
✅ **Same registry** - One `.agent-checkpoints.json` for both tools

### Example Workflow

**Captain32 Agents Team:**
```bash
# Agent runs, saves explicit checkpoints
# Hook auto-captures with AI labels too

# Use rewind for structured workflow
rewind day3 composition "what composition did you generate?"

# Use jump for general navigation
jump list
jump "Generated composition" "show me the cards"
```

**Other Teams (App, API):**
```bash
# Hook auto-captures everything
jump list
# Output:
# auto_1728210000: Fixed authentication bug in JWT validation
# auto_1728210900: Added comprehensive auth tests
# auto_1728211800: Refactored database query performance

# Navigate by description
jump "auth bug" "show me the fix"
jump "database" "what did you optimize?"
```

## Notes

- **Package manager**: This repo doesn't need one (just config/docs)
- **Git**: Initialize if documenting complex setups
- **Testing**: Always test MCP servers after installation before recommending to teams
