# UploadThing CLI - AI Instructions

## When to Use
- User wants to upload a local file and get a sharable URL
- Batch upload images for sharing
- Integrate into image generation pipelines

## Invocation
```bash
uploadthing upload <path...> [--name <filename>] [--metadata JSON] [--json]
uploadthing list [--limit N] [--json]
uploadthing delete <id>
uploadthing config set api-key <key>
uploadthing config show
```

## Integration Notes
- Reads `UPLOADTHING_API_KEY` or `~/.uploadthing/config.json`.
- JSON output contains: `id`, `name`, `size`, `mime`, `url`.
- On error, exit 1 and print message to stderr.
- Chain with `b64img` when dealing with base`64 inputs.
