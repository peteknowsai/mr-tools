# YouTube Transcript Pitfalls

**Confidence:** HIGH (based on library documentation, GitHub issues, and multiple sources)

## Common Failures

### 1. IP Blocking (Most Common in Production)
YouTube actively blocks IPs from cloud providers (AWS, GCP, Azure, DigitalOcean). Code works locally but fails on deployment with `RequestBlocked` or `IpBlocked` exceptions.

**Frequency:** Very common - affects nearly all cloud deployments
**Solution:** Use rotating residential proxies (WebShare recommended by library author)

### 2. Videos Without Transcripts
Transcripts unavailable when:
- Creator disabled captions
- Audio quality too poor for auto-generation
- Heavy accents or background noise
- Non-supported language
- Video uploaded before auto-captioning existed
- Video is too new (can take hours to generate)

**Frequency:** ~10-20% of videos lack usable transcripts
**Exception:** `TranscriptsDisabled` or `NoTranscriptFound`

### 3. Age-Restricted Content
Cannot access without authentication. Cookie-based auth is currently broken due to YouTube API changes.

**Exception:** `AgeRestricted`
**Solution:** None currently - must use official YouTube Data API with OAuth

### 4. Private Videos
No programmatic access without owner credentials.

**Solution:** Request owner share the SRT file directly

### 5. Unlisted Videos
CAN be accessed if you have the video ID - treated like public for transcript purposes.

## Edge Cases

### Live Streams
- **During stream:** Captions only work with "normal latency" (not low/ultra-low), English only
- **After stream:** Original live captions are DISCARDED - new auto-captions generated from VOD
- **Accuracy:** 80-90% for live, may differ from post-stream version

### Very Long Videos (2+ hours)
- YouTube allows up to 12 hours
- Most transcript tools handle any length
- Memory concerns for processing large transcripts (12-hour video = ~100k+ words)
- Consider chunking or streaming for very long content

### Non-English Content
- Auto-captions available for many languages but quality varies
- Translation available via `translate()` method
- Some languages not supported for auto-generation
- Exception: `NotTranslatable` or `TranslationLanguageNotAvailable`

### Regional Restrictions
- Some videos blocked in certain countries
- Exception: `VideoUnplayable` with details
- Solution: Proxy from allowed region

## Reliability Concerns

### API Stability
The youtube-transcript-api library has had several breaking changes:
- **v0.6.0 (2024):** Major refactor, deprecated methods removed
- **v1.1.0 (June 2025):** Switched from HTML scraping to innertube API
- YouTube changes can break the library at any time
- Not an official API - relies on reverse-engineering

### Exception Types to Handle
```
YouTubeTranscriptApiException (base)
├── RequestBlocked / IpBlocked        # Cloud deployment issues
├── TranscriptsDisabled              # Creator disabled
├── NoTranscriptFound                # Language not available
├── AgeRestricted                    # Needs auth (broken)
├── VideoUnavailable                 # Deleted/removed
├── VideoUnplayable                  # Regional/other restrictions
├── InvalidVideoId                   # Bad input
├── PoTokenRequired                  # New protection (rare)
└── YouTubeRequestFailed             # Network issues
```

### Rate Limiting
- No official rate limit documented
- Heavy usage triggers IP blocking
- Third-party APIs (youtube-transcript.io) limit to 5 requests/10 seconds
- Residential proxies help avoid blocks

## Recommendations

### For Local Development
1. Use youtube-transcript-api directly - works fine locally
2. Handle all exception types gracefully
3. Implement language fallback (try 'en', then 'en-US', then any available)

### For Production Deployment
1. **Use rotating residential proxies** - WebShare is recommended
2. Consider paid third-party APIs (youtube-transcript.io, ScrapingDog) for reliability
3. Implement retry logic with exponential backoff
4. Cache transcripts aggressively - they rarely change

### Error Handling Strategy
```typescript
// Pseudocode for robust handling
try {
  transcript = getTranscript(videoId)
} catch (e) {
  if (e instanceof RequestBlocked) {
    // Rotate proxy, retry
  } else if (e instanceof NoTranscriptFound) {
    // Offer alternative: "No transcript available"
  } else if (e instanceof AgeRestricted) {
    // Can't access - inform user
  } else if (e instanceof VideoUnavailable) {
    // Video deleted
  }
}
```

### Graceful Degradation
- Always have a fallback message for unavailable transcripts
- Consider offering audio extraction + Whisper as backup
- Cache results - transcripts don't change often

## Sources
- [youtube-transcript-api GitHub](https://github.com/jdepoix/youtube-transcript-api)
- [RequestBlocked Error Guide](https://medium.com/@lhc1990/fixing-youtube-transcript-api-requestblocked-error-a-developers-guide-83c77c061e7b)
- [YouTube Live Captions Help](https://support.google.com/youtube/answer/6373554)
- [3Play Media Statistics](https://www.3playmedia.com/accessibility-online-video-stats/)
- [youtube-transcript-api Issues](https://github.com/jdepoix/youtube-transcript-api/issues)
