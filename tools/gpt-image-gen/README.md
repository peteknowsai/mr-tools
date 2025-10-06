# GPT-Image-Gen CLI

A high-performance command-line tool built with Bun for generating, editing, and creating variations of images using OpenAI's models. Supports GPT-Image-1 for generation and DALL-E 2 for variations and editing.

## Features

- 🚀 **Lightning Fast** - Built with Bun, <50ms startup time
- 🎨 **Multiple Models** - GPT-Image-1 for generation, DALL-E 2 for variations/edits
- ✏️ **Image Editing** - Edit existing images with prompts and optional masks
- 🔄 **Image Variations** - Create variations of existing images
- 📦 **Base64 Handling** - Automatic conversion from base64 to binary
- 🔄 **Batch Processing** - Generate multiple images from prompt files
- 💾 **Multiple Formats** - Support for PNG, JPG, and WebP output
- 🔑 **Secure API Key Storage** - Environment variables or config file
- 🎯 **Smart Retry Logic** - Automatic retry with exponential backoff
- 📊 **Cost Estimation** - Shows estimated API costs before generation

## Installation

### Option 1: Using install-tool.sh (Recommended)
```bash
# From tool-library directory
./install-tool.sh gpt-image-gen
```

### Option 2: Direct Binary Download
```bash
# Download latest compiled binary (no dependencies required)
curl -L https://github.com/yourusername/gpt-image-gen/releases/latest/download/gpt-image-gen-$(uname -s)-$(uname -m) -o gpt-image-gen
chmod +x gpt-image-gen
sudo mv gpt-image-gen /usr/local/bin/
```

### Option 3: Build from Source
```bash
# Requires Bun installed
cd gpt-image-gen
./build.sh
```

## Configuration

### API Key Setup

Set your OpenAI API key using one of these methods:

```bash
# Method 1: Environment variable (recommended)
export OPENAI_API_KEY=sk-...

# Method 2: Config file
gpt-image-gen config set api-key sk-...

# Method 3: Command flag (not recommended)
gpt-image-gen "prompt" --api-key sk-...
```

### Default Settings

Configure default values:
```bash
gpt-image-gen config set defaultQuality high
gpt-image-gen config set defaultSize 1024x1536
gpt-image-gen config set defaultOutputDir ./images
```

## Usage

### Basic Image Generation

```bash
# Simple generation
gpt-image-gen "A sunset over mountains"

# With specific output file
gpt-image-gen "A happy golden retriever" --output dog.png

# High quality, specific size
gpt-image-gen "Abstract art" --quality high --size 1024x1536
```

### Image Variations (DALL-E 2)

```bash
# Create variations of an existing image
gpt-image-gen variations input.png --count 3 --output-dir ./variations/

# Single variation with specific output
gpt-image-gen variations photo.png --output variation.png

# Different size variations
gpt-image-gen variations art.png --size 512x512 --count 5
```

### Image Editing (DALL-E 2)

```bash
# Edit with mask (transparent areas will be edited)
gpt-image-gen edit photo.png --mask mask.png "Add a rainbow in the sky"

# Edit without mask (full image context)
gpt-image-gen edit portrait.png "Make it look like an oil painting"

# Multiple edits
gpt-image-gen edit scene.png --count 3 "Add fireworks" --output-dir ./edits/
```

### Multiple Images

```bash
# Generate 3 images from prompt
gpt-image-gen "A magical forest" --count 3 --output-dir ./forests/

# Different formats
gpt-image-gen "City skyline" --format webp --quality auto
```

### Batch Processing

```bash
# Create a prompt file
cat > prompts.txt << EOF
A serene Japanese garden with koi pond
A futuristic cyberpunk city at night
An abstract painting in blue and gold
EOF

# Process all prompts
gpt-image-gen batch prompts.txt --output-dir ./batch-output/
```

### Advanced Options

```bash
# Read prompt from file
gpt-image-gen --prompt-file description.txt --output result.png

# Output raw base64 (for piping to other tools)
gpt-image-gen "cat" --base64 | b64img --auto

# Get metadata as JSON
gpt-image-gen "landscape" --json

# Quiet mode for scripting
gpt-image-gen "robot" --quiet --output robot.png
```

## Command Options

| Option | Short | Description |
|--------|-------|-------------|
| `--output FILE` | `-o` | Output file path |
| `--output-dir DIR` | `-d` | Directory for multiple images |
| `--size SIZE` | `-s` | Image size: 1024x1024, 1024x1536, 1536x1024 |
| `--quality QUALITY` | `-q` | Quality: low, medium, high, auto |
| `--count N` | `-n` | Number of images (1-10) |
| `--format FORMAT` | `-f` | Output format: png, jpg, webp |
| `--prompt-file FILE` | `-p` | Read prompt from file |
| `--base64` | `-b` | Output raw base64 |
| `--json` | `-j` | Output metadata as JSON |
| `--api-key KEY` | | OpenAI API key |
| `--quiet` | | Suppress progress messages |
| `--help` | `-h` | Show help message |

## Model Specifications

### GPT-Image-1 Characteristics
- **Model**: `gpt-image-1` (NOT DALL-E models)
- **Response Format**: Base64 only (no URLs)
- **Quality Options**: low, medium, high, auto
- **Size Options**: 1024x1024, 1024x1536, 1536x1024
- **Max Images**: 10 per request
- **Max Prompt Length**: 4000 characters

### Cost Estimation
Approximate costs per image:
- Low quality: ~$0.01
- Medium quality: ~$0.02
- High quality: ~$0.04
- Auto quality: ~$0.03

## Integration Examples

### With b64img Tool
```bash
# Generate and convert in pipeline
gpt-image-gen "sunset" --base64 | b64img --auto
```

### With Cloud Storage
```bash
# Generate and upload to S3
gpt-image-gen "product photo" --output temp.png && \
aws s3 cp temp.png s3://bucket/images/

# Generate and upload to Cloudflare
gpt-image-gen "logo" --output logo.png && \
cf-images upload logo.png
```

### In Scripts
```bash
#!/bin/bash
# Batch generate with error handling
for prompt in "cat" "dog" "bird"; do
  if gpt-image-gen "$prompt" --quiet --output-dir ./animals/; then
    echo "✓ Generated $prompt"
  else
    echo "✗ Failed to generate $prompt"
  fi
done
```

## Performance

- **Startup Time**: <50ms
- **Generation Time**: 2-5 seconds typically
- **Base64 Decoding**: ~1GB/sec
- **Binary Size**: ~15MB compiled
- **Memory Usage**: Streaming for large images

## Error Handling

The tool provides clear error messages for common issues:

- **Invalid API Key**: Check your OpenAI API key
- **Rate Limits**: Automatic retry with exponential backoff
- **Invalid Parameters**: Clear validation messages
- **Network Errors**: Descriptive connection errors
- **Content Policy**: Prompt validation warnings

## Development

### Building from Source
```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Clone and build
cd gpt-image-gen
bun install
./build.sh

# Build for all platforms
bun run build.ts
```

### Project Structure
```
gpt-image-gen/
├── src/
│   ├── cli.ts          # CLI entry point
│   ├── api.ts          # OpenAI API client
│   ├── converter.ts    # Base64 conversion
│   ├── config.ts       # Configuration management
│   └── types.ts        # TypeScript interfaces
├── build.sh            # Build script
├── build.ts            # Multi-platform build
├── package.json
└── tsconfig.json
```

## Troubleshooting

### API Key Issues
```bash
# Check if API key is set
echo $OPENAI_API_KEY

# Verify config
gpt-image-gen config
```

### Rate Limits
The tool automatically retries with exponential backoff. For persistent issues:
- Wait a few minutes
- Reduce batch size
- Use lower quality settings

### Large Base64 Responses
Base64 responses can be 1-2MB. The tool handles this efficiently with streaming.

## License

MIT

## Notes

- GPT-Image-1 ONLY returns base64 data, never URLs
- Always use model name "gpt-image-1", not DALL-E
- Quality values are "low", "medium", "high", "auto" (not "standard" or "hd")
- The tool automatically handles base64 to binary conversion