# yt-transcript

Fetch YouTube video transcripts via CLI.

## Quick Reference

```bash
# Basic usage - timestamped transcript
yt-transcript "https://youtube.com/watch?v=VIDEO_ID"

# JSON output (for programmatic use)
yt-transcript --json "https://youtu.be/VIDEO_ID"

# Plain text without timestamps
yt-transcript --no-timestamps "https://youtube.com/shorts/VIDEO_ID"

# Direct video ID
yt-transcript dQw4w9WgXcQ
```

## Supported URL Formats

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`
- Just the video ID: `dQw4w9WgXcQ`

## Output Formats

### Default (Timestamped)
```
[0:00] Hello everyone
[0:05] Welcome to the video
[0:12] Today we'll discuss...
```

### JSON Mode (`--json`)
```json
{
  "status": "complete",
  "video_id": "dQw4w9WgXcQ",
  "transcript": [
    {"start": 0.0, "duration": 2.5, "text": "Hello everyone"},
    {"start": 2.5, "duration": 3.0, "text": "Welcome to the video"}
  ]
}
```

### Plain Text (`--no-timestamps`)
```
Hello everyone
Welcome to the video
Today we'll discuss...
```

## Error Handling

**JSON error format:**
```json
{
  "status": "error",
  "error": "Error message here",
  "video_id": "xyz123"
}
```

**Common errors:**
- `Transcripts disabled by video owner`
- `No transcript available for this video`
- `Video not available`
- `Age-restricted content not supported`
- `Invalid YouTube URL`

## Exit Codes

- `0` - Success
- `1` - Error (transcript unavailable, invalid URL, etc.)

## Integration with youtube-analyst Agent

The `youtube-analyst` sub-agent uses this tool automatically when users paste YouTube URLs. It fetches the transcript in JSON mode and provides summaries with timestamp references.

## Setup

```bash
cd /Users/pete/Projects/mr-tools
./tools/yt-transcript/setup.sh
```

This creates a Python virtual environment and installs dependencies.

## Dependencies

- Python 3.x
- `youtube-transcript-api` package
