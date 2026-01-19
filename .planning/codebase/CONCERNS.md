# Codebase Concerns

**Analysis Date:** 2026-01-19

## Tech Debt

**Stub Workflows Not Implemented:**
- Issue: Five workflow tools are stubs that output "STUB: not yet implemented" messages
- Files:
  - `workflows/email/gmail_latest_from.ts`
  - `workflows/scheduling/cal_next_free.ts`
  - `workflows/scheduling/cal_today.ts`
  - `workflows/auth/clerk_verify_pin.ts`
  - `workflows/content/post_quick.ts`
- Impact: Listed in CLAUDE.md documentation but unusable; agents may try to call them
- Fix approach: Either implement them or remove from documentation and delete files

**Inconsistent Config Path References:**
- Issue: Some tools reference `~/.config/tool-library/` while others use `~/.config/mr-tools/`
- Files:
  - `tools/gmail/gmail.ts` (line 8: `~/.config/tool-library/gmail`)
  - `tools/google-calendar/gcal.ts` (line 7: `~/.config/tool-library/google-calendar`)
  - `tools/grok/grok.ts` (line 85: references `~/.config/tool-library/secrets.json` in output)
  - `tools/cal-com/cal-com.ts` (line 106: references `~/.config/tool-library/secrets.json` in output)
- Impact: Confusing to users; tokens stored in inconsistent locations
- Fix approach: Standardize all tools to use `~/.config/mr-tools/` as defined in `lib/config.ts`

**Hardcoded Claude Executable Path:**
- Issue: Claude executable path is hardcoded in multiple files
- Files:
  - `lib/checkpoint.ts` (line 236: `/Users/pete/.claude/local/claude`)
  - `tools/rewind/rewind.ts` (line 217: `/Users/pete/.claude/local/claude`)
  - `tools/jump/jump.ts` (line 131: `/Users/pete/.claude/local/claude`)
- Impact: Tools will break for any user other than Pete
- Fix approach: Make configurable via environment variable or discover dynamically

**Duplicated Checkpoint Logic:**
- Issue: `tools/rewind/rewind.ts` duplicates checkpoint management code from `lib/checkpoint.ts`
- Files:
  - `tools/rewind/rewind.ts` (lines 24-133: inlined checkpoint manager)
  - `lib/checkpoint.ts` (canonical implementation)
- Impact: Code divergence risk; bug fixes need to happen in two places
- Fix approach: Import from `lib/checkpoint.ts` instead of inlining

**Empty Catch Blocks:**
- Issue: Several files have empty catch blocks that silently swallow errors
- Files:
  - `tools/gmail/gmail.ts` (line 72)
  - `tools/google-calendar/gcal.ts` (lines 61, 117)
  - `tools/uploadthing/uploadthing.ts` (line 76)
- Impact: Debugging failures becomes difficult; errors are hidden
- Fix approach: At minimum log errors; consider propagating or handling appropriately

## Known Bugs

**Google Calendar OAuth Flow Requires Manual URL Paste:**
- Symptoms: Auth flow requires user to manually copy/paste redirect URL
- Files: `tools/google-calendar/gcal.ts` (lines 113-118)
- Trigger: Running `gcal auth` for first-time authentication
- Workaround: Gmail tool has working loopback redirect server; gcal does not

**Slack Tools Use Different Config Keys:**
- Symptoms: `slack-send` and `slack-read` store tokens under different keys despite using same env var
- Files:
  - `tools/slack-send/slack-send.ts` (line 7: `tool: "slack-send"`)
  - `tools/slack-read/slack-read.ts` (line 7: `tool: "slack-read"`)
- Trigger: User configures one tool but expects the other to work
- Workaround: Configure both tools separately or use `SLACK_BOT_TOKEN` env var

## Security Considerations

**Secrets Stored in Plain JSON:**
- Risk: All API keys stored in plain text at `~/.config/mr-tools/secrets.json`
- Files: `lib/config.ts` (lines 6, 23-26)
- Current mitigation: None - file is world-readable by default
- Recommendations:
  - Set file permissions to 600 on creation
  - Consider using macOS Keychain or other secure storage
  - Add warning in documentation

**OAuth Tokens Stored Without Encryption:**
- Risk: Gmail and Google Calendar refresh tokens stored in plain JSON
- Files:
  - `tools/gmail/gmail.ts` (lines 77-80: saves to `TOKEN_FILE`)
  - `tools/google-calendar/gcal.ts` (lines 66-69: saves to `TOKEN_FILE`)
- Current mitigation: None
- Recommendations: Encrypt at rest or use system keychain

**API Keys Visible in Error Messages:**
- Risk: Some error handling may leak API keys in logs
- Files: Generic error handlers in all CLI tools
- Current mitigation: Most tools truncate keys in output
- Recommendations: Audit all error paths; never include full keys

## Performance Bottlenecks

**Nanobanana Cookie-Based Auth:**
- Problem: Relies on browser cookie extraction which can timeout or fail silently
- Files: `tools/nanobanana/nanobanana.py` (lines 45-87)
- Cause: Cookie extraction from Chrome requires Full Disk Access and can be slow
- Improvement path: Consider caching auth tokens; add progress indicators

**Jump Tool Loads All Checkpoints:**
- Problem: `getAutoCheckpoints()` loads all checkpoints into memory
- Files: `lib/checkpoint.ts` (lines 295-308)
- Cause: No pagination or filtering at file read time
- Improvement path: Add lazy loading or pagination for large checkpoint files

## Fragile Areas

**Gemini API Integration (Nanobanana):**
- Files: `tools/nanobanana/nanobanana.py` (lines 39-43, 99-116)
- Why fragile: Relies on undocumented internal API; header format changes break it
- Safe modification: Check gemini-webapi repo for updates before modifying
- Test coverage: None automated; relies on manual testing

**Replicate Model ID:**
- Files: `workflows/content/generate_card_art.ts` (line 32)
- Why fragile: Hardcoded model hash that can be deprecated
- Safe modification: Check Replicate for model updates
- Test coverage: None

**Claude Agent SDK Integration:**
- Files: `lib/checkpoint.ts`, `tools/rewind/rewind.ts`, `tools/jump/jump.ts`
- Why fragile: SDK is relatively new (version 0.1.8); API may change
- Safe modification: Pin SDK version; test thoroughly before upgrading
- Test coverage: None automated

## Scaling Limits

**Checkpoint File Size:**
- Current capacity: Works for sessions with hundreds of checkpoints
- Limit: JSON parsing becomes slow with thousands of checkpoints per session
- Scaling path: Move to SQLite or segment by session ID

**Batch Image Generation:**
- Current capacity: Works for ~10-50 images per batch
- Limit: Memory usage for base64 data can exceed available RAM
- Scaling path: Stream to disk instead of buffering

## Dependencies at Risk

**gemini-webapi (Nanobanana):**
- Risk: Unofficial library that reverse-engineers Gemini web interface
- Impact: Could break at any time if Google changes their API
- Migration plan: Monitor official Gemini API availability; switch when stable

**browser-cookie3 (Nanobanana):**
- Risk: Chrome updates may break cookie extraction
- Impact: Setup flow fails; users cannot authenticate
- Migration plan: Add manual cookie entry as fallback (already documented)

**@anthropic-ai/claude-agent-sdk:**
- Risk: Early version (0.1.8) of new SDK
- Impact: Breaking changes in future versions
- Migration plan: Pin version; test upgrades in isolation

## Missing Critical Features

**No Test Suite:**
- Problem: Zero automated tests for any tool
- Blocks: Confident refactoring; regression detection
- Priority: High - should add tests before major changes

**No Input Validation Library:**
- Problem: Each tool manually validates inputs
- Blocks: Consistent error messages; potential security issues
- Priority: Medium - consider Zod for all CLI argument parsing (already in deps)

**No Retry Logic for Network Calls:**
- Problem: Most tools fail immediately on network errors
- Blocks: Reliability in poor network conditions
- Priority: Low for dev tools; higher for production workflows

## Test Coverage Gaps

**All Core Libraries:**
- What's not tested: `lib/config.ts`, `lib/checkpoint.ts`
- Files: All files in `lib/`
- Risk: Breaking changes to config handling affect all tools
- Priority: High

**OAuth Flows:**
- What's not tested: Token refresh, expiration handling, auth code exchange
- Files: `tools/gmail/gmail.ts`, `tools/google-calendar/gcal.ts`
- Risk: Auth failures are hard to debug in production
- Priority: Medium

**Checkpoint Query Modes:**
- What's not tested: Point-in-time vs full context modes for rewind/jump
- Files: `tools/rewind/rewind.ts`, `tools/jump/jump.ts`
- Risk: Incorrect session resumption could give wrong agent context
- Priority: Medium

**CLI Argument Parsing:**
- What's not tested: Edge cases in argument parsing for all tools
- Files: All `tools/*/*.ts` files
- Risk: User-facing errors from malformed input
- Priority: Low

---

*Concerns audit: 2026-01-19*
