# Feature Landscape: Gemini Video Generation CLI

**Domain:** Video generation CLI tool using Veo 3.1
**Researched:** 2026-01-19
**Confidence:** HIGH (official Gemini API docs + ecosystem research)

## Executive Summary

Veo 3.1 video generation is fundamentally different from image generation in three critical ways:
1. **Asynchronous workflow** - Videos take 11 seconds to 6 minutes to generate, requiring polling patterns
2. **Complex prompting** - Effective video generation uses structured 5-part prompts with cinematography, audio, and timestamp controls
3. **Multi-modal inputs** - Reference images, frame interpolation, and video extension significantly expand capabilities

The CLI tool must bridge the gap between Veo's powerful but complex API and Claude Code's expectation of simple, synchronous workflows.

---

## Table Stakes

Features users expect. Missing = tool feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Text-to-video generation** | Core functionality | Medium | Already implemented, needs polish |
| **Async operation polling** | Videos aren't instant (11s-6min) | Medium | Must poll until `done: true` |
| **Status checking** | Users need to know generation progress | Low | Check operation status by ID |
| **Video retrieval** | Get completed videos | Low | Download from URI in response |
| **Error handling** | API failures, timeouts, quota limits | Medium | 10 concurrent limit, regional restrictions |
| **Progress indicators** | Long wait needs feedback | Low | "Generating... (polling every 10s)" |
| **File output** | Save to disk (Desktop, custom path) | Low | Like nanobanana image: `-d` and `-o` flags |
| **JSON mode** | Agent/programmatic integration | Low | `--json` flag for structured output |
| **Duration control** | 4s, 6s, or 8s clips | Low | API parameter `durationSeconds` |
| **Aspect ratio selection** | 16:9 (landscape) or 9:16 (portrait) | Low | TikTok/Shorts need vertical |
| **Resolution options** | 720p (default), 1080p, 4K | Low | Higher res = 8s duration required |

**MVP Priority (Phase 1):**
1. Text-to-video with polling (covers 80% of use cases)
2. Status checking (separate command or automatic)
3. File output to Desktop
4. JSON mode for Claude Code integration

---

## Differentiators

Features that would make this tool stand out. Not expected, but highly valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Reference image support** | Character/object consistency | Medium | Up to 3 images guide generation |
| **Structured prompt templates** | Better results without expertise | Low | Pre-built templates for common scenarios |
| **Cinematography shortcuts** | Easy camera movements | Low | `--dolly-shot`, `--close-up`, etc. |
| **Audio prompting helpers** | Synchronized sound/dialogue | Low | Separate flags for SFX vs dialogue |
| **Video extension workflow** | Videos longer than 8s | Medium | Chain 7s extensions (up to 20x) |
| **Frame interpolation** | Precise start/end control | Medium | First+last frame → smooth transition |
| **Batch generation queue** | Multiple videos in sequence | Medium | Handle 2 concurrent limit automatically |
| **Retry with backoff** | Resilient to API hiccups | Low | Auto-retry on transient failures |
| **Prompt validation** | Catch issues before generation | Low | Warn about negative prompts, dialogue format |
| **Cost estimation** | Know before generating | Low | $0.75/second, show total before confirm |
| **Local operation cache** | Resume interrupted polls | Low | Save operation ID + metadata to disk |
| **Negative prompting** | Exclude unwanted elements | Low | `--exclude` flag for negativePrompt |
| **Seed control** | Reproducible generations | Low | `--seed` for determinism attempts |
| **Video metadata** | Track prompts, parameters | Low | Save `.json` alongside video with full context |

**High-Impact Differentiators:**
1. **Reference images** - Game-changer for character consistency
2. **Structured prompt templates** - Lowers barrier to quality results
3. **Batch queue** - Essential given 2 concurrent limit
4. **Video extension workflow** - Only way to get >8s videos

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Real-time streaming** | Veo doesn't support it, adds complexity | Async polling with clear status |
| **Local video processing** | Out of scope, use ffmpeg instead | Generate and save raw output |
| **Prompt "AI enhancement"** | Users should control exact prompt | Provide templates, not auto-rewrite |
| **Video editing capabilities** | Not a video editor, generate-only | Save output, users edit externally |
| **Thumbnail preview** | Adds complexity, videos are short | Just generate, preview in Desktop |
| **Cloud storage integration** | Scope creep, local files sufficient | Save to Desktop, users upload if needed |
| **GUI/web interface** | CLI tool, not a web app | Keep terminal-focused |
| **Custom model selection** | Only Veo 3.1 available in API | Hard-code model, no option needed |
| **Synchronous generation** | Impossible with Veo latency | Embrace async, make UX smooth |
| **Background generation** | Complexity vs value tradeoff | User waits or polls separately |

**Key Philosophy:**
- **Generate, don't edit** - Veo creates videos, ffmpeg/external tools edit them
- **Explicit, not magical** - Users write prompts (with help), tool doesn't rewrite
- **Simple workflows** - Text → video or image+text → video, nothing fancier

---

## User Workflows

Common usage patterns for the tool.

### Workflow 1: Quick Text-to-Video (Default)

**Use case:** Claude Code needs to generate a simple video for user

```bash
# Generate with defaults (8s, 720p, 16:9)
nanobanana-video "A serene lake at sunset with gentle ripples"

# Output:
# Generating video... (operation: projects/.../operations/abc123)
# Polling status... ⏳
# Polling status... ⏳ (elapsed: 20s)
# Polling status... ⏳ (elapsed: 40s)
# ✓ Video complete!
# Saved to: /Users/pete/Desktop/20260119_142033.mp4
```

**Expected behavior:**
- Default output to Desktop (like current nanobanana)
- Progress indicators every 10s
- Auto-download when complete
- Exit code 0 on success

---

### Workflow 2: Custom Parameters

**Use case:** User wants vertical video for TikTok, higher resolution

```bash
nanobanana-video \
  "Close-up of a barista making latte art" \
  --duration 6 \
  --aspect-ratio 9:16 \
  --resolution 1080p \
  -o latte_art \
  -d ~/Desktop/videos

# Output: ~/Desktop/videos/latte_art.mp4
```

---

### Workflow 3: Reference Images (Character Consistency)

**Use case:** Generate video with specific character/object appearance

```bash
nanobanana-video \
  "The character walks through a busy market" \
  --reference character.png \
  --reference setting.png \
  --duration 8

# Upload 2 reference images, generate 8s video
# Output: Video with consistent character from reference
```

---

### Workflow 4: Structured Prompt with Audio

**Use case:** Generate video with dialogue and sound effects

```bash
nanobanana-video \
  "Medium shot, a woman says 'We need to leave now.' SFX: distant thunder. Ambient: rain on windows. Tense atmosphere, cinematic lighting." \
  --duration 8 \
  --resolution 1080p

# Better prompt structure = better results
```

**Tool could help with prompt template:**
```bash
nanobanana-video --template dialogue

# Prompts:
# Shot type (medium/close-up/wide): medium shot
# Subject: a woman
# Dialogue: "We need to leave now."
# Sound effects: distant thunder
# Ambient noise: rain on windows
# Mood: tense, cinematic lighting

# Generates structured prompt automatically
```

---

### Workflow 5: Check Status Separately

**Use case:** User starts generation, checks later

```bash
# Start generation without waiting
nanobanana-video "ocean waves" --async

# Output:
# Operation ID: projects/.../operations/abc123
# Video generating in background. Check status with:
#   nanobanana-video --status projects/.../operations/abc123

# Later, check status
nanobanana-video --status projects/.../operations/abc123

# Output:
# Status: done ✓
# Downloading video...
# Saved to: /Users/pete/Desktop/20260119_142033.mp4
```

---

### Workflow 6: Batch Queue (Multiple Videos)

**Use case:** Generate 5 videos, respect 2 concurrent limit

```bash
# Create batch file
cat > batch.txt <<EOF
A sunrise over mountains
A busy city street at night
Ocean waves crashing on shore
A forest path in autumn
Close-up of coffee brewing
EOF

nanobanana-video --batch batch.txt -d ~/Desktop/videos

# Output:
# Queued 5 videos (2 concurrent max)
# [1/5] Generating: A sunrise over mountains... ⏳
# [2/5] Generating: A busy city street at night... ⏳
# [1/5] Complete ✓ (saved: videos/video_001.mp4)
# [3/5] Generating: Ocean waves crashing... ⏳
# [2/5] Complete ✓ (saved: videos/video_002.mp4)
# ...
# All videos complete! (5/5)
```

**Handles concurrency limits automatically**

---

### Workflow 7: Agent Integration (JSON Mode)

**Use case:** Claude Code calls tool programmatically

```bash
nanobanana-video --json "a robot waving hello"

# Output (immediate):
{
  "status": "pending",
  "operation_id": "projects/.../operations/abc123",
  "estimated_time": "30-90 seconds"
}

# Poll for status
nanobanana-video --status abc123 --json

# Output (when done):
{
  "status": "complete",
  "filepath": "/Users/pete/Desktop/20260119_142033.mp4",
  "duration": 8,
  "resolution": "720p",
  "aspect_ratio": "16:9",
  "generation_time": 47
}
```

---

### Workflow 8: Video Extension (Longer Videos)

**Use case:** Create video longer than 8 seconds

```bash
# Generate initial clip
nanobanana-video "A hiker walks up a mountain trail" -o hike_part1

# Extend it
nanobanana-video --extend hike_part1.mp4 \
  "The hiker reaches the summit and looks at the view" \
  -o hike_part2

# Extension uses last second of part1 as context
# Can extend up to 20 times (total ~148 seconds)
```

---

## Feature Dependencies

```
Text-to-video (foundation)
  ├─→ Async polling (required for any generation)
  ├─→ Status checking (required for polling)
  ├─→ File output (required for usability)
  └─→ Progress indicators (UX enhancement)

Advanced inputs (build on foundation)
  ├─→ Reference images (independent)
  ├─→ Frame interpolation (independent)
  └─→ Video extension (requires completed video)

Batch operations (orchestration layer)
  ├─→ Text-to-video (uses N times)
  └─→ Concurrency management (respects API limits)

Prompt helpers (UX layer)
  ├─→ Templates (pre-built structures)
  ├─→ Validation (catch errors early)
  └─→ Cinematography shortcuts (convenience)
```

**Build order:**
1. Core generation (text-to-video + polling)
2. File output and status checking
3. Parameters (duration, aspect ratio, resolution)
4. Reference images (high-value differentiator)
5. Batch queue (handle concurrent limits)
6. Prompt helpers (UX polish)

---

## MVP Recommendation

For v1.0 milestone, prioritize:

### Must Have (Core Functionality)
1. **Text-to-video with async polling** - Core feature
2. **Status checking** - Required for async workflow
3. **File output** - Save to Desktop or custom path
4. **JSON mode** - Agent integration
5. **Duration/aspect ratio/resolution control** - Table stakes parameters
6. **Progress indicators** - UX for long waits
7. **Error handling** - API failures, quota limits, timeouts

### Should Have (High-Value Differentiators)
8. **Reference images** - Character consistency (huge value-add)
9. **Batch queue** - Handle 2 concurrent limit gracefully
10. **Retry with backoff** - Resilience to API issues
11. **Operation cache** - Resume interrupted polls
12. **Video metadata** - Save prompt/parameters alongside video

### Nice to Have (Polish)
13. **Prompt templates** - Help users structure prompts
14. **Negative prompting** - `--exclude` flag
15. **Cost estimation** - Show $0.75/second before generating
16. **Seed control** - Deterministic generation attempts

### Defer to Post-MVP
- Video extension (complex workflow, less common use case)
- Frame interpolation (advanced, low initial demand)
- Cinematography shortcuts (convenience, not essential)
- Batch file input (nice but can work around)

---

## Comparison to Image Generation (Nanobanana)

| Aspect | Image (Current) | Video (New) | Implication |
|--------|----------------|-------------|-------------|
| **Latency** | ~10-30s | 11s-6min | Must have better progress UX |
| **Workflow** | Synchronous | Asynchronous | Polling required, can't just wait |
| **Output size** | ~512x279 PNG (small) | 720p-4K MP4 (large) | File management more important |
| **Prompt complexity** | Simple text | 5-part structure + audio | Prompt helpers add more value |
| **Cost** | Free (with AI Pro) | $0.75/second | Cost awareness matters |
| **Concurrent limit** | Unknown (no docs) | 2 max | Batch queue essential |
| **Multi-modal inputs** | Edit mode only | Reference images, frames | New capabilities to expose |
| **Duration options** | N/A | 4s, 6s, 8s + extension | Configurable, not one-size-fits-all |

**Key insight:** Video generation is async-first, cost-aware, and multi-modal. Tool must embrace these differences, not fight them.

---

## Sources

- [Veo 3.1 Overview - Google DeepMind](https://deepmind.google/models/veo/)
- [Veo 3.1 Ingredients to Video - Google Blog](https://blog.google/innovation-and-ai/technology/ai/veo-3-1-ingredients-to-video/)
- [Gemini AI Video Generator - Gemini Overview](https://gemini.google/overview/video-generation/)
- [Generate videos with Veo 3.1 in Gemini API - Official Docs](https://ai.google.dev/gemini-api/docs/video)
- [Ultimate Prompting Guide for Veo 3.1 - Google Cloud Blog](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1)
- [Introducing Veo 3.1 in Gemini API - Google Developers Blog](https://developers.googleblog.com/introducing-veo-3-1-and-new-creative-capabilities-in-the-gemini-api/)
- [Veo 3.1 Review - GoEnhance AI](https://www.goenhance.ai/blog/veo-3-1-review)
- [Veo 3.1 Batch Video Generation - Skywork AI](https://skywork.ai/blog/ai-video/veo-3-1-batch-video-generation-and-automation/)
- [CLI UX Best Practices - Evil Martians](https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays)
- [Best AI Video Generators 2026 - Lets Enhance](https://letsenhance.io/blog/all/best-ai-video-generators/)
