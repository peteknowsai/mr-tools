#!/usr/bin/env python3
"""
yt-transcript: Fetch YouTube video transcripts

Usage:
    yt-transcript <url>                    # Timestamped transcript
    yt-transcript --json <url>             # JSON output for agents
    yt-transcript --no-timestamps <url>    # Plain text only
"""

import argparse
import json
import re
import sys
from typing import Optional

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)


def extract_video_id(url: str) -> Optional[str]:
    """Extract video ID from various YouTube URL formats."""
    patterns = [
        # Standard watch URL: youtube.com/watch?v=VIDEO_ID
        r'(?:youtube\.com/watch\?.*v=)([a-zA-Z0-9_-]{11})',
        # Short URL: youtu.be/VIDEO_ID
        r'(?:youtu\.be/)([a-zA-Z0-9_-]{11})',
        # Embed URL: youtube.com/embed/VIDEO_ID
        r'(?:youtube\.com/embed/)([a-zA-Z0-9_-]{11})',
        # Shorts URL: youtube.com/shorts/VIDEO_ID
        r'(?:youtube\.com/shorts/)([a-zA-Z0-9_-]{11})',
        # Just the video ID itself
        r'^([a-zA-Z0-9_-]{11})$',
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)

    return None


def format_timestamp(seconds: float) -> str:
    """Convert seconds to MM:SS or HH:MM:SS format."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)

    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def fetch_transcript(video_id: str) -> dict:
    """Fetch transcript for a video, returning structured result."""
    try:
        api = YouTubeTranscriptApi()
        result = api.fetch(video_id)
        return {
            "status": "complete",
            "video_id": video_id,
            "transcript": result.to_raw_data(),
        }
    except TranscriptsDisabled:
        return {
            "status": "error",
            "error": "Transcripts disabled by video owner",
            "video_id": video_id,
        }
    except NoTranscriptFound:
        return {
            "status": "error",
            "error": "No transcript available for this video",
            "video_id": video_id,
        }
    except VideoUnavailable:
        return {
            "status": "error",
            "error": "Video not available",
            "video_id": video_id,
        }
    except Exception as e:
        error_msg = str(e)
        if "age" in error_msg.lower() and "restrict" in error_msg.lower():
            return {
                "status": "error",
                "error": "Age-restricted content not supported",
                "video_id": video_id,
            }
        return {
            "status": "error",
            "error": f"Failed to fetch transcript: {error_msg}",
            "video_id": video_id,
        }


def output_json(result: dict) -> None:
    """Output result as JSON."""
    print(json.dumps(result, indent=2))


def output_text(result: dict, show_timestamps: bool = True) -> None:
    """Output transcript as formatted text."""
    if result["status"] == "error":
        print(f"Error: {result['error']}", file=sys.stderr)
        return

    for entry in result["transcript"]:
        text = entry["text"]
        if show_timestamps:
            timestamp = format_timestamp(entry["start"])
            print(f"[{timestamp}] {text}")
        else:
            print(text)


def main():
    parser = argparse.ArgumentParser(
        description="Fetch YouTube video transcripts",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    yt-transcript "https://youtube.com/watch?v=dQw4w9WgXcQ"
    yt-transcript --json "https://youtu.be/dQw4w9WgXcQ"
    yt-transcript --no-timestamps "https://youtube.com/shorts/abc123xyz"
        """
    )
    parser.add_argument("url", help="YouTube video URL or video ID")
    parser.add_argument(
        "--json", "-j",
        action="store_true",
        help="Output as JSON (for programmatic use)"
    )
    parser.add_argument(
        "--no-timestamps", "-n",
        action="store_true",
        help="Output plain text without timestamps"
    )

    args = parser.parse_args()

    # Extract video ID
    video_id = extract_video_id(args.url)
    if not video_id:
        error_result = {
            "status": "error",
            "error": "Invalid YouTube URL",
            "video_id": None,
        }
        if args.json:
            output_json(error_result)
        else:
            print(f"Error: {error_result['error']}", file=sys.stderr)
        sys.exit(1)

    # Fetch transcript
    result = fetch_transcript(video_id)

    # Output based on format
    if args.json:
        output_json(result)
    else:
        output_text(result, show_timestamps=not args.no_timestamps)

    # Exit with appropriate code
    sys.exit(0 if result["status"] == "complete" else 1)


if __name__ == "__main__":
    main()
