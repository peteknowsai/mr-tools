# Nanobanana & Geminipro Tools

AI-powered image generation, editing, and text generation using Google's Gemini 3 Pro via web interface authentication.

## Overview

These tools use cookie-based authentication from your Google AI Pro subscription to access:
- **nanobanana**: Image generation AND editing via Gemini 3 Pro
- **geminipro**: Text generation via Gemini 3 Pro with optional reasoning display

## Confirmed Capabilities (Tested January 2026)

| Feature | Tool | Status | Notes |
|---------|------|--------|-------|
| Image Generation | nanobanana | Working | 512x279 output (varies by prompt) |
| Image Editing | nanobanana --edit | Working | 1408x752 output (higher res) |
| Style Transfer | nanobanana --edit | Working | Watercolor, pencil sketch, etc. |
| Background Removal | nanobanana --edit | Working | Replace with solid colors |
| Object Addition | nanobanana --edit | Working | Add elements to existing images |
| Text Generation | geminipro | Working | Full Gemini 3 Pro capabilities |
| Reasoning/Thinking | geminipro --think | Working | Shows model's thought process |
| Code Generation | geminipro | Working | Python, JS, etc. |
| Video Generation | geminipro (prompt) | Async | Returns placeholder, max 2 concurrent |

## Quick Start

```bash
# Setup (one time)
./setup.sh                    # Create venv and install deps
nanobanana --setup            # Extract cookies from Chrome

# Generate images
nanobanana "a sunset over Tampa Bay"
nanobanana --json "a friendly robot" -o robot

# Edit existing images
nanobanana --edit photo.png "convert to watercolor style"
nanobanana --edit image.png "remove the background"
nanobanana --edit pic.png "add a red ball next to the subject"

# Chat with Gemini 3 Pro
geminipro "explain how neural networks work"
geminipro --think "what is 17 * 23?"
geminipro --json "your question"

# Video generation (async - returns placeholder)
geminipro "Generate a video of ocean waves at sunset"
```

## Authentication

Both tools share authentication via cookies stored at `~/.nanobanana/cookies.json`.

**Setup process:**
1. Log into https://gemini.google.com in Chrome (with AI Pro subscription)
2. Run `nanobanana --setup` or `geminipro --setup`
3. Cookies are extracted automatically from Chrome

**Manual setup** (if automatic extraction fails):
1. Go to https://gemini.google.com (logged in)
2. Open DevTools (F12) > Application > Cookies
3. Copy `__Secure-1PSID` and `__Secure-1PSIDTS` values
4. Create `~/.nanobanana/cookies.json`:
   ```json
   {
     "Secure_1PSID": "your-value",
     "Secure_1PSIDTS": "your-value"
   }
   ```

## Nanobanana (Image Generation & Editing)

### Image Generation

```bash
nanobanana "prompt"                     # Generate image
nanobanana -o filename "prompt"         # Custom filename (no extension)
nanobanana -d /path/to/dir "prompt"     # Custom output directory
nanobanana --timeout 180 "prompt"       # Longer timeout
nanobanana --json "prompt"              # JSON output for programmatic use
nanobanana --debug "prompt"             # Show debug information
```

### Image Editing

```bash
nanobanana --edit input.png "edit instructions"
nanobanana --edit photo.png "make it a watercolor painting"
nanobanana --edit image.png "remove the background and make it white"
nanobanana --edit pic.png "add a rainbow in the sky"
nanobanana --edit logo.png "change the colors to blue and gold"
```

**Edit capabilities:**
- Style transfer (watercolor, pencil sketch, oil painting, etc.)
- Background removal/replacement
- Object addition/removal
- Color adjustments
- Pose modifications

**Output locations:**
- Default: `~/.nanobanana/images/<timestamp>.png`
- Custom: `-d /path -o name` creates `/path/name.png`

**Output resolution:**
- Generation: ~512x279 (varies based on content)
- Editing: ~1408x752 (higher resolution)

**JSON output format:**
```json
{"status": "complete", "filepath": "/path/to/image.png"}
```
or
```json
{"status": "error", "error": "Error message"}
```

## Geminipro (Text Generation)

```bash
geminipro "your question"               # Get response from Gemini 3 Pro
geminipro --think "complex problem"     # Show model's reasoning process
geminipro --json "prompt"               # JSON output for programmatic use
geminipro --timeout 180 "prompt"        # Longer timeout
```

**JSON output format:**
```json
{"status": "complete", "text": "Response text", "thoughts": "Reasoning (if --think)"}
```

## Video Generation

Video generation is accessible through the Gemini 3 Pro interface but is **asynchronous**:

```bash
geminipro "Generate a short video of a cat playing"
# Returns: "I'm generating your video. Check back to see when it's ready."
```

**Limitations:**
- Maximum 2 concurrent video generation requests
- Videos are generated asynchronously (not immediate)
- Currently no CLI support for retrieving completed videos

## Technical Notes

### Model Headers

Both tools use Gemini 3 Pro (`"9d8ca3786ebdfbea"`). The header format that enables image generation:

```python
MODEL_HEADER = {"x-goog-ext-525001261-jspb": '[1,null,null,null,"9d8ca3786ebdfbea",null,null,0,[4],null,null,2]'}
```

Additional payload parameters:
- `idx17=[[1]]` - Enables image generation mode
- `idx49=14` - Sets generation parameters

Reference: [gemini-webapi PR #209](https://github.com/HanaokaYuzu/Gemini-API/pull/209)

### Dependencies

- `gemini-webapi>=1.17.0` - Authentication and session management
- `httpx>=0.24.0` - Async HTTP client for streaming
- `browser-cookie3>=0.19.0` - Cookie extraction from Chrome
- `orjson>=3.9.0` - Fast JSON serialization
- `Pillow>=10.0.0` - Image processing

### Troubleshooting

**"I can search for images, but can't create any"**
- Header format may be outdated
- Run `nanobanana --setup` to refresh cookies
- Check for gemini-webapi updates

**"No cookies" error**
- Run `nanobanana --setup` or `geminipro --setup`
- Ensure you're logged into gemini.google.com in Chrome

**Cookie extraction fails**
- Close Chrome during extraction
- Try manual setup (see Authentication section)
- On macOS: Ensure Full Disk Access for Terminal

**Timeout errors**
- Increase timeout: `--timeout 180`
- Complex prompts or edits need more time

**Video Generation Limit**
- "You have 2 video generation requests running"
- Wait for current videos to complete

## Integration Examples

### For Agents

```bash
# Generate image and get path
result=$(nanobanana --json "a product photo of...")
filepath=$(echo "$result" | jq -r '.filepath')

# Edit an image
result=$(nanobanana --edit "$filepath" --json "remove background")
edited=$(echo "$result" | jq -r '.filepath')

# Get text response
response=$(geminipro --json "analyze this data..." | jq -r '.text')

# Get reasoning
result=$(geminipro --think --json "solve this problem")
thoughts=$(echo "$result" | jq -r '.thoughts')
answer=$(echo "$result" | jq -r '.text')
```

### For Scripts

```python
import subprocess
import json

# Generate image
result = subprocess.run(
    ["nanobanana", "--json", "your prompt"],
    capture_output=True, text=True
)
data = json.loads(result.stdout)
if data["status"] == "complete":
    print(f"Image saved to: {data['filepath']}")

# Edit image
result = subprocess.run(
    ["nanobanana", "--edit", data['filepath'], "--json", "make it vintage"],
    capture_output=True, text=True
)
edited = json.loads(result.stdout)
```

## Model Information

| Tool | Model | Capabilities | Output |
|------|-------|--------------|--------|
| nanobanana | Gemini 3 Pro | Image generation | ~512x279 PNG |
| nanobanana --edit | Gemini 3 Pro | Image editing | ~1408x752 PNG |
| geminipro | Gemini 3 Pro | Text, reasoning, code | Text response |
| geminipro (video) | Veo 3.1 | Video generation | Async (up to 8s) |

**Note:** All capabilities are accessed via the Google AI Pro subscription web interface. No separate API keys required.
