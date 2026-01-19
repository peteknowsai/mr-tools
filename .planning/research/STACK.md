# Stack Research: Gemini Video Generation

**Project:** mr-tools nanobanana enhancement
**Milestone:** v1.0 - Add video generation and retrieval
**Researched:** 2026-01-19
**Confidence:** HIGH

## Executive Summary

Adding video generation to nanobanana requires **switching authentication methods** from cookie-based (gemini-webapi) to API key-based (google-genai SDK). The current gemini-webapi library does not support video generation. Video generation is a paid feature requiring either API credits or a Google AI Pro subscription.

**Key architectural change:** Current tool uses unofficial browser cookie auth → New feature requires official API key auth

## Recommended Stack

### Core Video Generation Library

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **google-genai** | >=1.59.0 | Official SDK for Veo video generation | Only library with official video generation support; unified SDK for all Gemini models; actively maintained; deprecated google-generativeai as of Aug 2025 |
| Python | >=3.10 | Runtime requirement | Required by google-genai SDK |

### Polling & Async Management

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| **aiohttp** | >=3.9.0 | Async HTTP client (optional) | 10x faster than httpx for high-concurrency async operations; recommended optional dependency for google-genai |
| **backoff** | >=2.2.0 | Exponential backoff for polling | Industry-standard retry logic with jitter; prevents thundering herd; cleaner than manual sleep loops |

### Keep Current Dependencies

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| httpx | >=0.24.0 | Sync/async HTTP client | Keep for backward compatibility with image generation; slower than aiohttp but supports HTTP/2 |
| gemini-webapi | >=1.17.0 | Cookie-based auth for images | Keep for existing image generation; does not support video |
| Pillow | >=10.0.0 | Image processing | Unchanged |
| browser-cookie3 | >=0.19.0 | Cookie extraction | Keep for image generation auth |
| orjson | >=3.9.0 | Fast JSON parsing | Unchanged |

## Authentication Architecture

### Current (Image Generation)
```
Browser Cookies → gemini-webapi → Gemini Web Interface
- __Secure-1PSID + __Secure-1PSIDTS cookies
- Extracted via browser-cookie3
- Auto-refreshing session tokens
- Unofficial web scraping approach
```

### New (Video Generation)
```
API Key → google-genai SDK → Gemini Developer API
- GEMINI_API_KEY environment variable
- Official API access
- Paid tier required ($0.15-$0.40 per second)
```

### Hybrid Approach (Recommended)
```python
# Image generation: Keep existing cookie-based approach
if mode == "image":
    use gemini-webapi with cookies

# Video generation: Use API key approach
if mode == "video":
    use google-genai with GEMINI_API_KEY
```

**Rationale:** Cookie-based image generation works and is free. API key is only needed for paid video features.

## Video Generation API Pattern

### 1. Initiate Generation
```python
from google import genai
from google.genai import types

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

operation = client.models.generate_videos(
    model='veo-3.1-generate-preview',
    prompt='A cat playing piano',
    config=types.GenerateVideosConfig(
        number_of_videos=1,
        duration_seconds=8,      # 5-8 seconds supported
        aspect_ratio='16:9',     # or '9:16'
        enhance_prompt=True,
        person_generation='dont_allow'
    )
)
```

### 2. Poll for Completion
```python
import backoff
import time

@backoff.on_predicate(
    backoff.expo,
    lambda op: not op.done,
    max_time=900,        # 15 minutes max
    max_tries=45,        # ~45 checks at 20s intervals
    jitter=backoff.full_jitter
)
def wait_for_video(operation):
    return client.operations.get(operation)

operation = wait_for_video(operation)
```

**Alternative (manual polling):**
```python
while not operation.done:
    time.sleep(20)  # Official docs recommend 20s intervals
    operation = client.operations.get(operation)
```

### 3. Download Video
```python
for n, generated_video in enumerate(operation.response.generated_videos):
    client.files.download(file=generated_video.video)
    generated_video.video.save(f'video_{n}.mp4')
```

## Polling Best Practices

| Aspect | Recommendation | Rationale |
|--------|---------------|-----------|
| **Initial interval** | 20 seconds | Google's official recommendation; videos take 30s-6min to generate |
| **Max timeout** | 900 seconds (15 min) | Covers peak usage scenarios; official docs suggest 5-10 min typical |
| **Backoff strategy** | Exponential with full jitter | Prevents retry storms; AWS-recommended pattern |
| **Max retries** | 45 attempts | At 20s intervals = 15 minutes total |
| **Progress indicator** | Log every 5th check | User feedback without spam |

## Cost Analysis

### Official Google Pricing (2026)

| Tier | Cost per Second | 8-Second Video | Notes |
|------|----------------|----------------|-------|
| Veo 3.1 Fast | $0.15/sec | $1.20 | Faster generation, good quality |
| Veo 3.1 Standard | $0.40/sec | $3.20 | Higher quality, slower |

### Subscription Option

| Plan | Monthly Cost | Credits | Videos (~8s each) | Effective Cost |
|------|-------------|---------|-------------------|----------------|
| Google AI Pro | $19.99 | 1,000 | ~50 Veo 3.1 Fast | $0.40/video |
| Ultra | $249.99 | 25,000 | ~2,500 Veo 3.1 Fast | $0.10/video |

**Note:** Free tier does NOT include video generation. API key required = paid tier only.

### Third-Party API Gateways (Optional)

| Provider | Cost per Video (8s) | Savings | Risk |
|----------|-------------------|---------|------|
| laozhang.ai | $0.15 | 95% | Third-party reliability unknown |
| Kie.ai | $0.40-$2.00 | 40-50% | Third-party SLA unclear |
| fal.ai/Replicate | $0.10/sec | Variable | Additional API dependencies |

**Recommendation:** Use official Google API for reliability and support. Third-party gateways introduce dependency risk.

## Installation

```bash
# New dependencies for video generation
pip install google-genai>=1.59.0
pip install aiohttp>=3.9.0        # Optional but recommended
pip install backoff>=2.2.0

# Keep existing dependencies
pip install gemini-webapi>=1.17.0
pip install httpx>=0.24.0
pip install Pillow>=10.0.0
pip install browser-cookie3>=0.19.0
pip install orjson>=3.9.0
```

**Updated requirements.txt:**
```
# Image generation (existing)
gemini-webapi>=1.17.0
Pillow>=10.0.0
browser-cookie3>=0.19.0
httpx>=0.24.0
orjson>=3.9.0

# Video generation (new)
google-genai>=1.59.0
aiohttp>=3.9.0
backoff>=2.2.0
```

## What to Avoid

### ❌ Don't Use: gemini-webapi for Video

**Why:**
- Library does not support video generation
- Web interface returns async placeholders only
- No retrieval mechanism available
- Unofficial library - no guarantee of continued Veo access

**Evidence:**
- Current CLAUDE.md states: "Currently no CLI support for retrieving completed videos"
- Library focuses on text, images, and extensions only
- Web interface messages: "I'm generating your video. Check back to see when it's ready."

### ❌ Don't Use: google-generativeai (Legacy SDK)

**Why:**
- Deprecated as of August 31, 2025
- No longer receiving feature updates
- Does not support Python 3.13
- Replaced by google-genai unified SDK

**Migration:** google-generativeai → google-genai (unified SDK)

### ❌ Don't Use: httpx for Video Polling

**Why:**
- 10x slower than aiohttp for async operations
- Benchmarks show significant performance gap
- Video polling requires high-frequency checks (every 20s for up to 15 min)
- aiohttp is recommended optional dependency for google-genai

**When to use httpx:** Keep for existing image generation (sync/async dual mode convenience)

### ❌ Don't Use: Manual Sleep Loops

**Why:**
- No exponential backoff = potential retry storms
- No jitter = thundering herd risk
- Manual timeout tracking is error-prone
- Reinventing solved problems

**Alternative:** Use backoff library for production-ready retry logic

### ❌ Don't Use: Free Tier Expectations

**Why:**
- Gemini API free tier does NOT include video generation
- Veo models require paid tier or subscription
- December 2025 quota cuts reduced free tier by 50-80%
- Video generation is explicitly paid-only

**Implication:** Tool must fail gracefully without API key or with free tier key

## Integration Points

### With Existing nanobanana Architecture

```python
# Current: Image generation only
async def generate_image_streaming(prompt, ...):
    # Uses gemini-webapi + cookies
    client = GeminiClient(secure_1psid=...)
    response = await client.generate_content(...)

# New: Add video generation
async def generate_video(prompt, ...):
    # Uses google-genai + API key
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    operation = client.models.generate_videos(...)
    operation = await wait_for_completion(operation)
    return operation.response.generated_videos[0].video
```

### CLI Interface Extension

```bash
# Existing (keep)
nanobanana "prompt"                    # Image via cookies
nanobanana --edit img.png "prompt"     # Image editing via cookies

# New (add)
nanobanana --video "prompt"            # Video via API key
nanobanana --video --duration 8 "prompt"  # 8-second video
nanobanana --video --aspect 9:16 "prompt"  # Vertical video
```

### Authentication Fallback Strategy

```python
def get_auth_for_mode(mode: str):
    if mode == "video":
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise AuthError("Video generation requires GEMINI_API_KEY")
        return {"type": "api_key", "value": api_key}

    elif mode in ["image", "edit"]:
        cookies = load_cookies()  # Existing cookie logic
        if not cookies:
            raise AuthError("Image generation requires cookies. Run: nanobanana --setup")
        return {"type": "cookies", "value": cookies}
```

### Shared Configuration

Both authentication methods can coexist:

```
~/.nanobanana/
├── cookies.json              # Existing: Browser cookies for images
└── config.json               # New: API key for videos
```

Or use environment variable:
```bash
export GEMINI_API_KEY="your-key-here"
nanobanana --video "prompt"
```

## Error Handling Requirements

### API Key Validation
```python
if not api_key:
    return {
        "status": "error",
        "error": "Video generation requires GEMINI_API_KEY. Get one from https://aistudio.google.com/apikey"
    }
```

### Quota/Billing Errors
```python
try:
    operation = client.models.generate_videos(...)
except Exception as e:
    if "quota" in str(e).lower() or "billing" in str(e).lower():
        return {
            "status": "error",
            "error": "Video generation requires paid tier. Free tier does not support Veo models."
        }
```

### Timeout Handling
```python
try:
    operation = wait_for_video(operation, timeout=900)
except TimeoutError:
    return {
        "status": "timeout",
        "error": "Video generation timed out after 15 minutes. Peak usage may require longer waits.",
        "operation_id": operation.name  # Allow manual retry
    }
```

## Performance Considerations

### Video Generation Latency

| Stage | Time | Notes |
|-------|------|-------|
| Request submission | < 1s | Immediate operation ID return |
| Queue wait | 0-300s | Peak usage = longer wait |
| Generation | 30-360s | Typical: 60-120s |
| Total | 30s-11min | Google official: "11s min, up to 6min peak" |

### Polling Efficiency

**Inefficient (naive):**
```python
# Polls 900 times in 15 minutes = excessive
while not done:
    time.sleep(1)
    check_status()
```

**Efficient (exponential backoff):**
```python
# Starts at 10s, doubles to max 60s with jitter
# ~45 checks total in 15 minutes
@backoff.expo(max_time=900, max_value=60)
def poll():
    return client.operations.get(operation)
```

### Memory Management

```python
# Download large videos efficiently
with open(output_path, 'wb') as f:
    client.files.download(
        file=generated_video.video,
        stream=True  # Stream to disk, don't load in memory
    )
```

## Sources

### Official Documentation (HIGH Confidence)
- [Generate videos with Veo 3.1 in Gemini API](https://ai.google.dev/gemini-api/docs/video) - Official API documentation
- [Google Gen AI SDK documentation](https://googleapis.github.io/python-genai/) - Official Python SDK docs
- [google-genai PyPI](https://pypi.org/project/google-genai/) - Package information and versions
- [Gemini API libraries](https://ai.google.dev/gemini-api/docs/libraries) - Official library recommendations

### Migration Guidance (HIGH Confidence)
- [Migrating to the new Google Gen AI SDK (Python)](https://medium.com/google-cloud/migrating-to-the-new-google-gen-ai-sdk-python-074d583c2350) - Migration guide from deprecated SDK
- [Need clarification about Google AI python packages](https://discuss.ai.google.dev/t/need-clarification-about-google-ai-python-packages-google-genai-vs-google-generativeai/61116) - Official forum clarification

### Pricing & Quotas (HIGH Confidence)
- [Gemini API Pricing and Quotas: Complete 2026 Guide](https://www.aifreeapi.com/en/posts/gemini-api-pricing-and-quotas) - Comprehensive pricing analysis
- [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing) - Official pricing page
- [Veo 3.1 Pricing & Access (2025)](https://skywork.ai/blog/veo-3-1-pricing-access-2025/) - Veo-specific pricing

### Implementation Patterns (MEDIUM Confidence)
- [Gemini Video Generation (Veo) | liteLLM](https://docs.litellm.ai/docs/providers/gemini/videos) - Alternative SDK patterns
- [backoff library](https://github.com/litl/backoff) - Exponential backoff implementation
- [HTTPX vs Requests vs AIOHTTP](https://oxylabs.io/blog/httpx-vs-requests-vs-aiohttp) - Performance comparison

### Performance Insights (MEDIUM Confidence)
- [HTTPX vs AIOHTTP performance](https://github.com/encode/httpx/issues/3215) - Known performance limitations
- [Google Cloud Workflows: exponential backoff](https://mbha-phoenix.medium.com/google-cloud-workflows-polling-backoff-dont-sleep-71af8fc88206) - Polling best practices

## Summary

**Core technology shift:** gemini-webapi (cookies) → google-genai (API key) for video only

**Keep existing:** Image generation continues using cookie-based auth

**New dependencies:** google-genai + aiohttp + backoff

**Cost implication:** Video generation is paid-only ($0.15-$0.40 per second)

**Polling pattern:** 20-second intervals with exponential backoff, 15-minute max timeout

**Integration:** Hybrid approach maintains backward compatibility for images while adding video capability
