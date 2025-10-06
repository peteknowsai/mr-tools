# Workflow-Specific Tools

This directory contains **workflow-specific tools** - focused, single-purpose utilities optimized for known agent workflows.

## Two-Tier Tool Architecture

### Tier 1: General CLI Tools (`tools/`)
**Purpose:** Flexible, exploratory, discoverable
- Agents can use `--help` to learn capabilities
- Multiple subcommands under one tool
- Good for unknown/varied workflows

**Examples:**
- `gmail list`, `gmail search`, `gmail read`
- `cal-com bookings list`, `cal-com events create`
- `grok "question"`, `grok --model grok-2`

**When to use:** Agent needs to explore or perform varied tasks

---

### Tier 2: Workflow Tools (`workflows/`)
**Purpose:** Laser-focused, optimized for specific patterns
- One tool = one job
- No exploration needed, just execute
- Faster, fewer tokens, clear intent

**Examples:**
- `gmail_clerk_pin` - Get latest Clerk verification code
- `cal_today` - Show today's calendar
- `gmail_latest_from` - Get latest email from sender

**When to use:** Agent has a known, repeated workflow

---

## Naming Convention

Based on [Anthropic's guide](https://www.anthropic.com/engineering/writing-tools-for-agents):

### Pattern: `{domain}_{action}_{specifics}`

**Email workflows:**
- `gmail_clerk_pin` - Get Clerk verification PIN
- `gmail_latest_from` - Get latest email from specific sender
- `gmail_send_quick` - Send email without auth ceremony

**Scheduling workflows:**
- `cal_today` - Today's meetings
- `cal_tomorrow` - Tomorrow's meetings
- `cal_next_available` - Find next free slot

**Auth workflows:**
- `auth_clerk_pin` - Get Clerk PIN (alternative naming)
- `auth_verify_code` - Verify any auth code

**Content workflows:**
- `content_post_twitter` - Post to Twitter via Typefully
- `content_draft_save` - Save content draft

---

## Implementation Pattern

Workflow tools typically **wrap general CLI tools** for specific use cases:

```typescript
#!/usr/bin/env bun
// workflows/email/gmail_clerk_pin.ts

import { execSync } from 'child_process';

// Use general gmail CLI under the hood
const output = execSync('gmail search from:clerk.com subject:"verification code" -n 1 --json');
const email = JSON.parse(output.toString());

// Extract PIN from email body
const pin = extractPin(email.body);

console.log(pin);
```

**Benefits:**
- Reuses existing tools
- Clear, single purpose
- Optimized for agent workflows
- Easy to maintain

---

## Directory Structure

```
workflows/
├── auth/           # Authentication & verification
├── email/          # Email-specific workflows
├── scheduling/     # Calendar & meetings
└── content/        # Publishing & content creation
```

Each workflow is a standalone executable that does ONE thing well.
