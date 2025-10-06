# GPT-Image-Gen - AI Assistant Instructions

## Tool Purpose
Generate images using OpenAI's GPT-Image-1 model. This tool is specifically designed for GPT-Image-1, which returns base64 data (unlike DALL-E which can return URLs).

## Critical Implementation Details

### Model Specifications
- **ALWAYS use model**: `gpt-image-1` (NOT `dall-e-2` or `dall-e-3`)
- **Response format**: ONLY `b64_json` (GPT-Image-1 doesn't support URLs)
- **Quality values**: `low`, `medium`, `high`, `auto` (NOT `standard` or `hd`)
- **Size options**: `1024x1024`, `1024x1536`, `1536x1024`

## When to Use This Tool

### Automatic Triggers
- User asks to "generate an image" or "create a picture"
- User provides detailed visual descriptions
- Tasks requiring AI-generated imagery
- When DALL-E tools fail or aren't available

### Use Cases
- Creative content generation
- Placeholder images for development
- Concept visualization
- Batch image generation for datasets
- Testing image processing pipelines

## Integration Patterns

### With b64img Tool
```bash
# Generate and immediately convert
gpt-image-gen "prompt" --base64 | b64img --auto

# Generate multiple and batch convert
gpt-image-gen "prompt" --count 5 --output-dir ./raw/ && \
b64img ./raw/*.b64 --outdir ./images/
```

### With Cloud Storage
```bash
# Generate and upload to Cloudflare Images
gpt-image-gen "product photo" --output temp.png && \
cf-images upload temp.png --name "product-1"

# Batch generate and upload
for i in {1..5}; do
  gpt-image-gen "variation $i" --output "img-$i.png" && \
  cf-images upload "img-$i.png"
done
```

### Pipeline Examples
```bash
# Generate → Convert → Optimize → Upload
gpt-image-gen "logo" --base64 | \
b64img --stdout | \
convert - -quality 85 logo.jpg | \
aws s3 cp - s3://bucket/logo.jpg
```

## API Key Management

### Check for API Key
1. First check environment: `$OPENAI_API_KEY`
2. Then check config: `gpt-image-gen config get api-key`
3. If missing, prompt user to set it

### Setting API Key
```bash
# Preferred: environment variable
export OPENAI_API_KEY=sk-...

# Alternative: config file
gpt-image-gen config set api-key sk-...
```

## Error Handling

### Common Issues and Solutions

| Error | Solution |
|-------|----------|
| "Invalid API key" | Check/update OpenAI API key |
| "Rate limit exceeded" | Tool auto-retries, or wait and retry |
| "Invalid model" | Ensure using `gpt-image-1` not DALL-E |
| "Invalid quality" | Use low/medium/high/auto, not standard/hd |
| "Prompt too long" | Max 4000 characters |
| "Invalid size" | Must be one of the three supported sizes |

### Retry Logic
- Automatic exponential backoff for rate limits
- Max 3 retries by default
- Wait times: 1s, 2s, 4s between retries

## Performance Optimization

### For Speed
- Use `--quality low` for drafts
- Single image generation is faster than batch
- Pre-compile binary with `./build.sh`

### For Quality
- Use `--quality high` for production
- Size `1536x1024` or `1024x1536` for more detail
- Generate multiple variations with `--count`

### For Cost
- Use `--quality low` (~$0.01/image)
- Batch similar prompts together
- Preview with low quality, finalize with high

## Prompt Engineering Tips

### Best Practices
- Be specific about style, colors, composition
- Include artistic references (e.g., "oil painting style")
- Specify lighting and mood
- Add technical details (e.g., "8K resolution", "photorealistic")

### Example Prompts
```bash
# Detailed and specific
"A serene Japanese garden with a red wooden bridge over a koi pond, cherry blossoms in full bloom, soft morning light, watercolor painting style"

# Technical specification
"Modern minimalist logo design, geometric shapes, blue and white color scheme, flat design, vector art style, centered composition"

# Photorealistic
"Professional product photography of a luxury watch, black background, dramatic lighting, macro lens, high detail, commercial style"
```

## Batch Processing

### From File
```bash
# Create prompt file
cat > prompts.txt << EOF
A cute robot assistant
A magical forest at twilight
An abstract representation of joy
EOF

# Process all
gpt-image-gen batch prompts.txt --output-dir ./results/
```

### Programmatic Generation
```bash
# Generate variations
for style in "oil painting" "watercolor" "pencil sketch"; do
  gpt-image-gen "Portrait in $style style" \
    --output "portrait-${style// /-}.png"
done
```

## Output Formats

### Binary Image (Default)
- Automatic base64 to binary conversion
- Supports PNG, JPG, WebP output
- Preserves image quality

### Raw Base64
- Use `--base64` flag
- For piping to other tools
- For embedding in JSON/HTML

### Metadata JSON
- Use `--json` flag
- Includes prompt, size, timestamp
- Useful for cataloging

## Cost Awareness

### Estimated Costs
- Low quality: ~$0.01 per image
- Medium quality: ~$0.02 per image  
- High quality: ~$0.04 per image
- Auto quality: ~$0.03 per image

### Cost Optimization
- Test with low quality first
- Use specific sizes (not auto)
- Batch similar requests
- Cache generated images

## Testing Commands

### Basic Functionality
```bash
# Test API connection
gpt-image-gen "test" --quality low --quiet

# Test batch processing
echo -e "cat\ndog" | gpt-image-gen batch /dev/stdin --output-dir ./test/

# Test configuration
gpt-image-gen config
```

## Important Reminders

1. **Model Name**: Always `gpt-image-1`, never DALL-E models
2. **Base64 Only**: GPT-Image-1 only returns base64, not URLs
3. **Quality Values**: Use low/medium/high/auto (not standard/hd)
4. **Size Limits**: Only three sizes supported
5. **Rate Limits**: Tool handles automatically with retries
6. **Max Prompt**: 4000 characters
7. **Max Images**: 10 per request

## Maintenance Notes

- Keep TypeScript types in sync with API changes
- Update cost estimates quarterly
- Test with latest Bun version
- Monitor OpenAI API deprecations
- Maintain backward compatibility