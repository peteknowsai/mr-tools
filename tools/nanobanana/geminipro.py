#!/usr/bin/env python3
"""
geminipro - Chat with Gemini 3 Pro via Google's web interface

Uses cookie-based auth from your Google AI Pro subscription.
Supports streaming responses and "thinking" mode.

Usage:
    geminipro --setup                    # Extract cookies from browser (shared with nanobanana)
    geminipro "your question"            # Chat with Gemini 3 Pro
    geminipro --json "prompt"            # JSON output for agents
    geminipro --think "complex prompt"   # Show model's reasoning
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

# Config paths (shared with nanobanana)
CONFIG_DIR = Path.home() / ".nanobanana"
COOKIE_FILE = CONFIG_DIR / "cookies.json"

# Exit codes
EXIT_SUCCESS = 0
EXIT_ERROR = 1


def setup_cookies():
    """Extract cookies from Chrome browser and save to config."""
    try:
        import browser_cookie3
    except ImportError:
        print("Error: browser-cookie3 not installed", file=sys.stderr)
        print("Run: pip install browser-cookie3", file=sys.stderr)
        sys.exit(EXIT_ERROR)

    print("Extracting cookies from Chrome...")

    try:
        cj = browser_cookie3.chrome(domain_name=".google.com")
    except Exception as e:
        print(f"Error accessing Chrome cookies: {e}", file=sys.stderr)
        print("\nManual setup instructions:", file=sys.stderr)
        print("1. Go to https://gemini.google.com (logged in)", file=sys.stderr)
        print("2. Open DevTools (F12) > Application > Cookies", file=sys.stderr)
        print("3. Copy __Secure-1PSID and __Secure-1PSIDTS values", file=sys.stderr)
        print(f"4. Create {COOKIE_FILE} with:", file=sys.stderr)
        print('   {"Secure_1PSID": "...", "Secure_1PSIDTS": "..."}', file=sys.stderr)
        sys.exit(EXIT_ERROR)

    cookies = {}
    for cookie in cj:
        if cookie.name == "__Secure-1PSID":
            cookies["Secure_1PSID"] = cookie.value
        elif cookie.name == "__Secure-1PSIDTS":
            cookies["Secure_1PSIDTS"] = cookie.value

    if "Secure_1PSID" not in cookies:
        print("Error: __Secure-1PSID cookie not found", file=sys.stderr)
        print("Make sure you're logged into gemini.google.com in Chrome", file=sys.stderr)
        sys.exit(EXIT_ERROR)

    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    COOKIE_FILE.write_text(json.dumps(cookies, indent=2))
    COOKIE_FILE.chmod(0o600)

    print(f"Cookies saved to {COOKIE_FILE}")
    if "Secure_1PSIDTS" not in cookies:
        print("Warning: __Secure-1PSIDTS not found (may still work)")


def load_cookies() -> dict:
    """Load cookies from config file."""
    if not COOKIE_FILE.exists():
        return None
    try:
        return json.loads(COOKIE_FILE.read_text())
    except json.JSONDecodeError:
        return None


async def chat(prompt: str, show_thoughts: bool = False, timeout: int = 120) -> dict:
    """Send prompt to Gemini 3 Pro and get response."""
    try:
        from gemini_webapi import GeminiClient
        from gemini_webapi.constants import Model
    except ImportError:
        return {"status": "error", "error": "gemini-webapi not installed. Run: pip install gemini-webapi"}

    cookies = load_cookies()
    if not cookies:
        return {"status": "error", "error": "No cookies. Run: geminipro --setup"}

    if "Secure_1PSID" not in cookies:
        return {"status": "error", "error": "Invalid cookies. Run: geminipro --setup"}

    try:
        client = GeminiClient(
            secure_1psid=cookies["Secure_1PSID"],
            secure_1psidts=cookies.get("Secure_1PSIDTS")
        )
        await client.init(timeout=timeout, auto_close=False, auto_refresh=False, verbose=False)

        response = await client.generate_content(prompt, model=Model.G_3_0_PRO)

        result = {
            "status": "complete",
            "text": response.text
        }

        # Include thoughts if available and requested
        if show_thoughts and response.candidates and response.candidates[0].thoughts:
            result["thoughts"] = response.candidates[0].thoughts

        return result

    except Exception as e:
        return {"status": "error", "error": str(e)}
    finally:
        if 'client' in locals():
            await client.close()


def main():
    parser = argparse.ArgumentParser(
        description="Chat with Gemini 3 Pro (Google's latest reasoning model)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  geminipro --setup                     Extract cookies from browser
  geminipro "explain quantum computing" Chat with Gemini 3 Pro
  geminipro --json "test prompt"        JSON output (for agents)
  geminipro --think "solve this puzzle" Show reasoning process
"""
    )
    parser.add_argument("prompt", nargs="?", help="Your prompt/question")
    parser.add_argument("--setup", action="store_true", help="Extract cookies from browser")
    parser.add_argument("--json", action="store_true", help="Output JSON (for programmatic use)")
    parser.add_argument("--think", action="store_true", help="Show model's thinking/reasoning")
    parser.add_argument("--timeout", type=int, default=120, help="Timeout in seconds (default: 120)")

    args = parser.parse_args()

    # Handle setup mode
    if args.setup:
        setup_cookies()
        return

    if not args.prompt:
        parser.error("prompt is required unless using --setup")

    result = asyncio.run(chat(args.prompt, show_thoughts=args.think, timeout=args.timeout))

    # Output result
    if args.json:
        print(json.dumps(result))
        if result["status"] == "error":
            sys.exit(EXIT_ERROR)
        else:
            sys.exit(EXIT_SUCCESS)
    else:
        if result["status"] == "complete":
            if args.think and "thoughts" in result:
                print("=== Reasoning ===")
                print(result["thoughts"])
                print("\n=== Response ===")
            print(result["text"])
            sys.exit(EXIT_SUCCESS)
        else:
            print(f"Error: {result['error']}", file=sys.stderr)
            sys.exit(EXIT_ERROR)


if __name__ == "__main__":
    main()
