# UploadThing CLI (Bun)

A fast Bun-based CLI to upload files to UploadThing and manage uploads.

## Installation

```bash
./install-tool.sh uploadthing
```

## Configuration

Set your API key one of the following ways (priority order):

1. Environment variable (recommended):
   ```bash
   export UPLOADTHING_API_KEY="ut_..."
   ```
2. Config file at `~/.uploadthing/config.json`:
   ```json
   {
     "api_key": "ut_...",
     "base_url": "https://uploadthing.com"  
   }
   ```

You can set it via the CLI:
```bash
uploadthing config set api-key ut_...
uploadthing config show
```

## Usage

```bash
# Upload a file (auto-detect MIME)
uploadthing upload ./path/to/file.png

# Upload with custom name and JSON metadata
uploadthing upload ./report.pdf --name Q2-Report.pdf --metadata '{"project":"alpha"}'

# Upload multiple files
uploadthing upload ./a.png ./b.jpg ./c.webp -d ./

# List uploads (server-side listing via API if available)
uploadthing list --limit 20 --json

# Delete an upload by id
uploadthing delete <id>

# Output JSON for scripting
uploadthing upload ./file.png --json
```

## Options

- `--json` Output machine-readable JSON
- `--name` Custom filename shown in UploadThing
- `--metadata` JSON string to send as metadata (validated)
- `--mime` Force MIME type if detection fails

## API

This tool uses the UploadThing REST endpoints with Bearer auth.

- Dashboard: [UploadThing Dashboard](https://uploadthing.com/dashboard/peteknowsai-personal-team/wr8iwwawbf/api-keys)

## Examples

```bash
# Pipe from stdin and save remote URL to clipboard
cat image.png | uploadthing upload --name image.png --json | jq -r '.url' | pbcopy
```

## Notes

- API key is read from `UPLOADTHING_API_KEY` or `~/.uploadthing/config.json`.
- Built with Bun. Use `./build.sh` to compile a single binary.
