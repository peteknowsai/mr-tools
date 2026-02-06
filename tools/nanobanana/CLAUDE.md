# Nanobanana - Gemini 3 Pro Image Generation

Generate images using Google's Gemini 3 Pro with optional Cloudflare Images upload.

## Quick Reference

```bash
# Local save
nanobanana "a sunset over mountains"              # Saves to ~/.nanobanana/images/
nanobanana -o myimage "prompt"                    # Custom filename

# Cloudflare Images (recommended for production)
nanobanana -c "a product photo"                   # Returns Cloudflare URL
nanobanana -c --json "prompt"                     # JSON with url + id

# Debug
nanobanana --debug "prompt"                       # Show request/response details
```

## Output Formats

**Local save (default):**
```json
{"status": "complete", "filepath": "/Users/pete/.nanobanana/images/20260202.png"}
```

**Cloudflare upload (`-c` flag):**
```json
{
  "status": "complete",
  "url": "https://imagedelivery.net/QVGF5JnCzllQ8d17KIHS8g/<id>/public",
  "id": "d10301f9-9817-4a62-8388-bed7c5bd5b00"
}
```

**Error:**
```json
{"status": "error", "error": "Error message"}
```

## Options

| Flag | Description |
|------|-------------|
| `-c, --cloudflare` | Upload to Cloudflare Images instead of local save |
| `-o, --output NAME` | Custom filename (no extension) |
| `-d, --dir PATH` | Custom output directory (local only) |
| `--json` | JSON output for programmatic use |
| `--debug` | Show debug information |
| `--setup` | Show cookie setup instructions |

## Authentication

**Gemini cookies** (required): `~/.nanobanana/cookies.json`
```json
{
  "Secure_1PSID": "your-value",
  "Secure_1PSIDTS": "your-value"
}
```

Get these from Chrome DevTools > Application > Cookies > gemini.google.com while logged into Google AI Pro.

**Cloudflare credentials** (for `-c` flag): `~/.config/mr-tools/secrets.json`
```json
{
  "cloudflare": {
    "account_id": "your-account-id",
    "images_token": "your-api-token"
  }
}
```

## Technical Details

- **Model**: Gemini 3 Pro (`9d8ca3786ebdfbea`)
- **Output resolution**: ~1408x768 PNG
- **Cloudflare delivery**: Converted to optimized JPEG

## Integration Examples

```bash
# Generate and get Cloudflare URL
url=$(nanobanana -c --json "product photo" | jq -r '.url')

# Generate locally then do something with the file
filepath=$(nanobanana --json "logo design" | jq -r '.filepath')
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No cookies" | Run `nanobanana --setup` |
| "Could not find access token" | Re-extract cookies from Chrome |
| "Cloudflare not configured" | Add credentials to secrets.json |
| "Cloudflare upload failed: 401" | Regenerate API token with Images permission |
