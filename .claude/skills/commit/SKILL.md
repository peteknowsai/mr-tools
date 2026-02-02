---
name: commit
description: Stage and commit all changes to the current branch with an auto-generated commit message. Checks for files that should be gitignored, reviews changes, generates a descriptive message, and commits.
---

# Commit - Smart Commit All Changes

Stages all changes and commits them to the current branch. Checks for files that should be ignored first.

## Instructions

### 1. Check Current State

```bash
# What branch are we on?
git branch --show-current

# What's changed (including untracked)?
git status --short
```

### 2. Check for Files That Should Be Ignored

Before staging, look for files that probably shouldn't be committed:

**Always ignore:**
- `node_modules/` - Dependencies
- `.env`, `.env.local`, `.env.*` - Secrets
- `*.log` - Log files
- `.DS_Store` - macOS junk
- `dist/`, `build/`, `out/` - Build outputs
- `*.pyc`, `__pycache__/`, `.venv/`, `venv/` - Python artifacts
- `coverage/`, `.nyc_output/` - Test coverage
- `*.sqlite`, `*.db` - Local databases
- Large binaries (>1MB compiled files)

**Check the untracked files:**
```bash
git status --porcelain | grep "^??" | cut -c4-
```

If any untracked files match ignore patterns:
1. Show Pete what should be ignored
2. Add them to `.gitignore`
3. Then proceed with commit

### 3. Stage Everything (after gitignore is clean)

```bash
git add -A
```

### 4. Review What's Being Committed

```bash
# See the diff of staged changes
git diff --cached --stat

# Get detailed diff for commit message context
git diff --cached
```

### 5. Generate Commit Message

Based on the changes, generate a commit message following conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `refactor:` - Code change that neither fixes a bug nor adds a feature
- `chore:` - Maintenance, dependencies, config
- `style:` - Formatting, whitespace
- `test:` - Adding or updating tests

Format: `type(scope): short description`

If multiple types of changes, use the most significant one or `chore` for mixed.

### 6. Commit

```bash
git commit -m "$(cat <<'EOF'
<commit message here>

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### 7. Confirm

```bash
# Show the commit we just made
git log --oneline -1

# Show current status (should be clean)
git status --short
```

Report: "Committed to `<branch>`: `<commit message>`"

If you updated `.gitignore`, mention what was added.
