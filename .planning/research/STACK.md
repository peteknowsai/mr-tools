# YouTube Transcript Stack Research

**Confidence:** HIGH

## Recommended Library

**`youtube-transcript-api`** — The clear winner for fetching existing YouTube transcripts.

```bash
pip install youtube-transcript-api
```

**Why this one:**
- No API key required (uses undocumented YouTube web API)
- No headless browser needed (unlike Selenium solutions)
- Supports auto-generated and manual captions
- Can translate transcripts
- Active maintenance

## How It Works

```python
from youtube_transcript_api import YouTubeTranscriptApi

api = YouTubeTranscriptApi()

# Basic fetch (video ID, not URL)
transcript = api.fetch("dQw4w9WgXcQ")

# With language preference (falls back through list)
transcript = api.fetch("dQw4w9WgXcQ", languages=['en', 'de'])

# Output: list of dicts
for snippet in transcript:
    print(f"{snippet['start']}: {snippet['text']}")
    # {'text': 'Hello', 'start': 0.0, 'duration': 1.5}
```

**Output format:**
- List of snippet dicts with `text`, `start` (seconds), `duration`
- Has `to_raw_data()` method for clean dict output
- Iterable and indexable

## No Auth Required

**Confirmed: No API key needed.**

The library scrapes YouTube's internal web API (same one the YouTube player uses). This is undocumented, so:
- Could break if YouTube changes their API
- No official rate limit documentation
- Works without any credentials

## Limitations

| Limitation | Details |
|------------|---------|
| Cloud IP blocking | YouTube blocks AWS, GCP, Azure, DigitalOcean IPs. Works locally, fails on cloud. |
| No captions = no transcript | If video has subtitles disabled, you get nothing |
| Rate limits exist | ~250 requests before throttling; add delays between requests |
| Video ID only | Pass `dQw4w9WgXcQ` not `https://youtube.com/watch?v=dQw4w9WgXcQ` |

**Cloud workaround:** Use residential proxies (Webshare recommended by library author) or Tor.

## Error Cases

```python
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
    RequestBlocked,
    InvalidVideoId,
    AgeRestricted
)

api = YouTubeTranscriptApi()

try:
    transcript = api.fetch(video_id)
except TranscriptsDisabled:
    # Uploader disabled captions
    pass
except NoTranscriptFound:
    # No transcript in requested language
    pass
except VideoUnavailable:
    # Video deleted or private
    pass
except RequestBlocked:
    # IP blocked (common on cloud)
    pass
except InvalidVideoId:
    # Bad video ID format
    pass
except AgeRestricted:
    # Age-gated content
    pass
```

## Auto-Generated vs Manual Captions

```python
api = YouTubeTranscriptApi()

# List available transcripts first
transcript_list = api.list(video_id)

# Get specific type
manual = transcript_list.find_manually_created_transcript(['en'])
auto = transcript_list.find_generated_transcript(['en'])

# Check what you got
transcript = api.fetch(video_id)
print(transcript.is_generated)  # True = auto-generated
```

## Alternatives

| Library | Use Case | Trade-off |
|---------|----------|-----------|
| `yt-dlp` | Download subtitle files (VTT/SRT) | Requires parsing VTT; more setup |
| `yt-dlp + Whisper` | Videos without captions | Slow; requires downloading audio |
| `pytube` | Avoid — frequently broken | yt-dlp is better maintained |

**Recommendation:** Use `youtube-transcript-api` for existing captions. Fall back to `yt-dlp + Whisper` only if video has no captions and you must have a transcript.

## Production Checklist

- [ ] Extract video ID from URL (don't pass full URL)
- [ ] Handle all error cases gracefully
- [ ] Add 1-2 second delay between requests
- [ ] If deploying to cloud: use residential proxy
- [ ] Check `is_generated` if caption quality matters

## Sources

- [youtube-transcript-api GitHub](https://github.com/jdepoix/youtube-transcript-api)
- [youtube-transcript-api PyPI](https://pypi.org/project/youtube-transcript-api/)
- [Fixing RequestBlocked Error Guide](https://medium.com/@lhc1990/fixing-youtube-transcript-api-requestblocked-error-a-developers-guide-83c77c061e7b)
- [Using yt-dlp for transcripts](https://medium.com/@jallenswrx2016/using-yt-dlp-to-download-youtube-transcript-3479fccad9ea)
- [Rate limits discussion](https://github.com/jdepoix/youtube-transcript-api/issues/66)
