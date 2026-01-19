# mr-tools

## What This Is

Pete's tooling and infrastructure hub for the Captain32 workspace. Houses MCP servers, CLI tools, and system-wide utilities that support development across all Captain32 teams.

## Core Value

Provide reliable, well-documented tools that enable autonomous AI development workflows across all projects.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ CLI tool infrastructure (compile, install, PATH integration)
- ✓ MCP server management (Chrome DevTools, Docker MCP)
- ✓ Nanobanana image generation via Gemini 3 Pro
- ✓ Geminipro text generation with reasoning display
- ✓ Checkpoint/rewind system for agent temporal inspection
- ✓ Jump system for auto-labeled navigation

### Active

<!-- Current scope. Building toward these. -->

- [ ] Video generation and retrieval via nanobanana
- [ ] Enhanced media capabilities (image + video workflow)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Real-time streaming — complexity vs value tradeoff
- Mobile app tools — Captain32-mobile handles its own tooling

## Context

- Nanobanana uses cookie-based auth via Google AI Pro subscription
- Video generation triggers via Veo 3.1 but returns placeholder (async)
- Currently no CLI support for retrieving completed videos
- Max 2 concurrent video generation requests

## Constraints

- **Auth**: Cookie-based (browser-cookie3), requires Google login
- **API limits**: 2 concurrent video generations max
- **Async**: Video generation is not immediate, requires polling/retrieval

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Cookie auth over API key | Google AI Pro subscription provides access | ✓ Good |
| Compiled binaries over npm | Fast startup, no runtime deps | ✓ Good |
| gemini-webapi library | Best community support for Gemini web interface | ✓ Good |

---
*Last updated: 2026-01-19 after initial PROJECT.md creation*
