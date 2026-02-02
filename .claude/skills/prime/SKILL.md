---
name: prime
description: Boot up for a fresh mr-tools session. Reviews recent commits, scans project state, checks GSD planning, and maintains a session scratchpad. Use at the start of any session to get oriented quickly.
---

# Prime - Session Bootup for mr-tools

This skill primes the conversation with essential context about the mr-tools project.

## Instructions

### 1. Read the Scratchpad

Read `.claude/prime-state.md` to see notes from previous sessions, in-progress work, and things to remember.

### 2. Check Recent Git Activity

```bash
# Recent commits (last 10)
git log --oneline -10

# Uncommitted changes
git status --short

# Current branch
git branch --show-current
```

### 3. Scan Project Structure

```bash
# Tools available
ls tools/

# Any planning state (GSD)?
ls .planning/ 2>/dev/null && ls .planning/features/ 2>/dev/null
```

### 4. Check for In-Progress GSD Work

If `.planning/features/` has subdirectories, read any `current-plan.md` or similar files to understand active work.

### 5. Update the Scratchpad

Update `.claude/prime-state.md` with:
- **Last Primed:** current timestamp
- **Recent Activity:** summary of recent commits
- **Current Focus:** what's being worked on
- **In-Progress Items:** uncommitted changes, active features
- Append to **Session History** with today's date

### 6. Report Ready

Give Pete a concise summary (3-5 lines max):
1. Recent activity (what's been happening)
2. Current state (uncommitted changes, active branches)
3. Any in-progress GSD work
4. Ready for instructions

Keep it brief - Pete wants to work, not read.
