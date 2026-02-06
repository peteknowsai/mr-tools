# YouTube Transcript Tool — Research Summary

## Stack Decision
**Library:** `youtube-transcript-api`
- No API key required
- Uses undocumented YouTube web API
- Active maintenance
- Supports auto-generated and manual captions

## Key Implementation Notes
1. **Pass video ID, not URL** — Extract `dQw4w9WgXcQ` from URL first
2. **Handle 8+ exception types:**
   - `TranscriptsDisabled`
   - `NoTranscriptFound`
   - `RequestBlocked`
   - `AgeRestricted`
   - `VideoUnavailable`
   - `VideoUnplayable`
   - `InvalidVideoId`
   - `PoTokenRequired`

3. **Rate limits** — ~250 requests before throttling (not a concern for CLI use)

## Sub-Agent Pattern
- Markdown file with YAML frontmatter
- Location: `~/.claude/agents/youtube-analyst.md`
- Tools via allowlist: `tools: Bash, Read`
- Description enables auto-detection
- Body is system prompt

## Pitfalls to Avoid
- Cloud deployment blocked (YouTube blocks AWS/GCP IPs) — OK since this is local CLI
- Age-restricted content inaccessible (no workaround)
- API is reverse-engineered, may break with YouTube changes
