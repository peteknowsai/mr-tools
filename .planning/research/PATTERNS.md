# Claude Code Sub-Agent Patterns

**Confidence:** HIGH (verified from official docs and working examples)

## How Sub-Agents Work

Sub-agents are Markdown files with YAML frontmatter. The frontmatter defines metadata (name, tools, model), and the body becomes the system prompt. When Claude determines a task matches a sub-agent's description, it delegates automatically via the `Task` tool. Sub-agents run in isolated contexts with their own tool access.

## Configuration Location

| Location | Scope | Priority |
|----------|-------|----------|
| `--agents` CLI flag | Current session only | 1 (highest) |
| `.claude/agents/` | Current project | 2 |
| `~/.claude/agents/` | All projects (user-level) | 3 |
| Plugin's `agents/` directory | Where plugin enabled | 4 (lowest) |

**Pete's setup:** User-level agents at `~/.claude/agents/` include `meta-agent.md`, `gsd-researcher.md`, `performance-optimizer.md`, etc.

## Configuration Format

```yaml
---
name: my-agent                      # Required: kebab-case identifier
description: When to use this agent # Required: triggers auto-delegation
tools: Read, Grep, Glob, Bash       # Optional: comma-separated tool list
disallowedTools: Write, Edit        # Optional: tools to block
model: sonnet                       # Optional: sonnet|opus|haiku|inherit (default: sonnet)
permissionMode: default             # Optional: default|acceptEdits|dontAsk|bypassPermissions|plan
skills:                             # Optional: skills to preload
  - my-skill
color: cyan                         # Optional: display color
hooks:                              # Optional: lifecycle hooks
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./validate.sh"
---

# System Prompt Body

You are [role]. When invoked:
1. [Step 1]
2. [Step 2]
```

## Tool Access

**Three approaches:**

1. **Allowlist (recommended):** Specify exactly which tools the agent can use
   ```yaml
   tools: Read, Grep, Glob, Bash
   ```

2. **Denylist:** Block specific tools (inherits all others)
   ```yaml
   disallowedTools: Write, Edit
   ```

3. **Inherit all:** Omit both fields; agent gets all tools from main conversation

**Common tool sets:**

| Use Case | Tools |
|----------|-------|
| Read-only analysis | `Read, Grep, Glob` |
| Research | `Read, Write, Bash, Grep, Glob, WebSearch, WebFetch` |
| Full coding | `Read, Write, Edit, Bash, Grep, Glob` |
| MCP access | `mcp__server__*` (wildcard) or `mcp__server__tool` (specific) |

## Invocation

**Automatic delegation:** Claude reads the `description` field and automatically delegates when a task matches.

**Explicit invocation:** User can request directly:
```
Use the code-reviewer subagent to review my changes
Have the gsd-researcher investigate authentication patterns
```

**From custom commands:** Use the `Task` tool in command definitions:
```yaml
# In a custom command (.claude/commands/my-command.md)
---
allowed-tools:
  - Task
---

Spawn gsd-researcher agent:
Task(
  prompt="Research [topic]",
  subagent_type="gsd-researcher",
  description="Research [topic]"
)
```

**Blocking sub-agents:**
```json
{
  "permissions": {
    "deny": ["Task(Explore)", "Task(my-custom-agent)"]
  }
}
```

## Example: Minimal Read-Only Agent

```yaml
---
name: code-reviewer
description: Reviews code for quality, security, and best practices
tools: Read, Grep, Glob
model: sonnet
---

You are a code reviewer. When invoked:
1. Run `git diff` to see changes
2. Analyze modified files
3. Report issues by priority (critical, warning, suggestion)
```

## Example: Research Agent with MCP Access

```yaml
---
name: gsd-researcher
model: opus
description: Researches domains, features, and implementation approaches
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*
color: cyan
---

<role>
You are a GSD researcher. You investigate domains and features.
</role>

<output_format>
Write findings to `.planning/research/[TOPIC].md`
</output_format>
```

## Example: Agent with Hooks (Validation)

```yaml
---
name: db-reader
description: Execute read-only database queries
tools: Bash
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-readonly-query.sh"
---

You are a database analyst with read-only access.
Execute SELECT queries only. Block write operations.
```

## Best Practices

1. **Minimal tool access:** Only grant tools the agent needs
2. **Clear description:** Write action-oriented descriptions for auto-delegation
3. **Structured prompts:** Use sections like `<role>`, `<instructions>`, `<output_format>`
4. **Model selection:** Use `haiku` for fast/simple, `sonnet` for balanced, `opus` for complex
5. **Permission modes:** Use `plan` for read-only exploration, `acceptEdits` for automated fixes
6. **Return format:** Define how the agent should report back to the caller

## Pitfalls

- **Too many tools:** Agents with full tool access can do unexpected things
- **Vague descriptions:** Auto-delegation fails if description is unclear
- **Missing Write tool:** Agents that need to output files need `Write` explicitly
- **MCP wildcards:** `mcp__server__*` grants ALL tools from that server

## Sources

- Official docs: https://code.claude.com/docs/en/sub-agents
- Official docs: https://code.claude.com/docs/en/settings
- Working examples: `~/.claude/agents/` (gsd-researcher.md, meta-agent.md, etc.)
