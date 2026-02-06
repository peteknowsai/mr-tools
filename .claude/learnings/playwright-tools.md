# Playwright in mr-tools

## 2026-02-05 — Cookie refresh tool (PR #1)

### Compilation limitation
- Playwright tools cannot be compiled to standalone binaries with `bun build --compile`
- Native browser dependencies break compilation
- **Workaround**: Use wrapper scripts in `bin/` that call `bun run <source>.ts`
- The wrapper script gets installed to `~/.local/bin/` like compiled binaries

### Setup pattern
- Use `--setup` flag for first-time interactive login
- Headless mode for subsequent automated runs
- Persistent browser context at `~/.nanobanana/playwright-profile/` retains sessions
