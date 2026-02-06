---
name: nanobanana
description: This skill provides image generation and editing capabilities using Google's Gemini 3 Pro model via the nanobanana CLI tool. Use this skill when users request AI image generation, image editing (style transfer, background removal, object manipulation), or when visual content needs to be created for projects. Also includes geminipro for Gemini 3 Pro text generation with optional reasoning display.
---

# Nanobanana - AI Image Generation

Generate images using Gemini 3 Pro with automatic Cloudflare Images upload.

## When to Use

- User asks for AI-generated images
- Need product photos, logos, illustrations
- Creating visual content for projects
- Image editing requests (style transfer, background removal)

## Instructions

### Generate an Image

Use `--cloudflare` (`-c`) to upload directly to Cloudflare Images and get a public URL:

```bash
nanobanana -c --json "your prompt here"
```

**Output:**
```json
{
  "status": "complete",
  "url": "https://imagedelivery.net/QVGF5JnCzllQ8d17KIHS8g/<id>/public",
  "id": "uuid-here"
}
```

### Local Save (Alternative)

If you need the file locally instead:

```bash
nanobanana --json "your prompt here"
```

**Output:**
```json
{"status": "complete", "filepath": "/Users/pete/.nanobanana/images/20260202.png"}
```

### Custom Filename

```bash
nanobanana -c -o product-hero --json "product photography of sneakers"
```

### Debugging

If generation fails, use `--debug` to see details:

```bash
nanobanana --debug "your prompt" 2>&1
```

## Error Handling

Check the `status` field in JSON output:

```bash
result=$(nanobanana -c --json "prompt")
status=$(echo "$result" | jq -r '.status')

if [ "$status" = "complete" ]; then
  url=$(echo "$result" | jq -r '.url')
  echo "Generated: $url"
else
  error=$(echo "$result" | jq -r '.error')
  echo "Failed: $error"
fi
```

## Common Errors

| Error | Solution |
|-------|----------|
| "No cookies" | Run `cookie-refresh --setup` to extract cookies via browser login |
| "Could not find access token" | Cookies expired. Run `nanobanana --rotate --debug` to refresh. If 401, run `cookie-refresh --setup` |
| "Cloudflare upload failed" | Check API token in `~/.config/mr-tools/secrets.json` |

**Note:** Cookie rotation is automatic — nanobanana rotates `__Secure-1PSIDTS` before each generation. A launchd task also runs daily at 3am. Full session re-auth (`cookie-refresh --setup`) is only needed when the primary `__Secure-1PSID` expires (rare, every few months).

## Tips for Better Results

- Be specific: "a red sports car on a mountain road at sunset" > "car"
- Include style hints: "minimalist", "photorealistic", "watercolor style"
- Specify composition: "centered", "wide angle", "close-up"

## Report to User

After generating, share:
1. The Cloudflare URL (clickable)
2. Brief description of what was generated
3. If there was an error, explain and suggest fixes
