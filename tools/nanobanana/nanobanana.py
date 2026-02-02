#!/usr/bin/env python3
"""
nanobanana - Generate and edit images using Gemini 3 Pro

Uses cookie-based auth from your Google AI Pro subscription.
Supports image generation, editing, and style transfer.

Usage:
    nanobanana --setup                              # Extract cookies from browser
    nanobanana "a friendly robot"                   # Generate image
    nanobanana --edit image.png "make it blue"      # Edit existing image
    nanobanana --json "prompt"                      # JSON output for agents
    nanobanana -o logo -d /tmp "prompt"             # Custom output
"""

import argparse
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

# Config paths
CONFIG_DIR = Path.home() / ".nanobanana"
COOKIE_FILE = CONFIG_DIR / "cookies.json"
DEFAULT_OUTPUT_DIR = CONFIG_DIR / "images"

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


async def edit_image(prompt: str, input_image: Path, output_dir: Path, filename: str, timeout: int = 120, debug: bool = False) -> dict:
    """Edit an existing image using Gemini 3 Pro."""
    try:
        from gemini_webapi import GeminiClient
        from gemini_webapi.constants import Model
    except ImportError:
        return {"status": "error", "error": "gemini-webapi not installed. Run: pip install gemini-webapi"}

    if not input_image.exists():
        return {"status": "error", "error": f"Input image not found: {input_image}"}

    cookies = load_cookies()
    if not cookies:
        return {"status": "error", "error": "No cookies. Run: nanobanana --setup"}

    if "Secure_1PSID" not in cookies:
        return {"status": "error", "error": "Invalid cookies. Run: nanobanana --setup"}

    try:
        if debug:
            print(f"Initializing GeminiClient for image editing...", file=sys.stderr)
            print(f"Input image: {input_image}", file=sys.stderr)

        client = GeminiClient(
            secure_1psid=cookies["Secure_1PSID"],
            secure_1psidts=cookies.get("Secure_1PSIDTS")
        )
        await client.init(timeout=timeout, auto_close=False, auto_refresh=False, verbose=debug)

        if debug:
            print(f"Sending edit request with prompt: {prompt}", file=sys.stderr)

        response = await client.generate_content(
            prompt,
            files=[str(input_image)],
            model=Model.G_3_0_PRO
        )

        if response.images:
            if debug:
                print(f"Found {len(response.images)} edited image(s)", file=sys.stderr)

            output_dir.mkdir(parents=True, exist_ok=True)
            await response.images[0].save(path=str(output_dir), filename=f"{filename}.png")
            filepath = output_dir / f"{filename}.png"

            return {"status": "complete", "filepath": str(filepath)}
        else:
            error_msg = response.text if response.text else "No image returned from edit request"
            if debug:
                print(f"No images returned. Text: {error_msg}", file=sys.stderr)
            return {"status": "error", "error": error_msg}

    except Exception as e:
        if debug:
            import traceback
            traceback.print_exc()
        return {"status": "error", "error": str(e)}
    finally:
        if 'client' in locals():
            await client.close()


async def generate_image(prompt: str, output_dir: Path, filename: str, timeout: int = 120, debug: bool = False) -> dict:
    """Generate image using gemini-webapi library directly."""
    try:
        from gemini_webapi import GeminiClient
        from gemini_webapi.constants import Model
    except ImportError:
        return {"status": "error", "error": "gemini-webapi not installed. Run: pip install gemini-webapi"}

    cookies = load_cookies()
    if not cookies:
        return {"status": "error", "error": "No cookies. Run: nanobanana --setup"}

    if "Secure_1PSID" not in cookies:
        return {"status": "error", "error": "Invalid cookies. Run: nanobanana --setup"}

    try:
        if debug:
            print("Initializing GeminiClient...", file=sys.stderr)

        client = GeminiClient(
            secure_1psid=cookies["Secure_1PSID"],
            secure_1psidts=cookies.get("Secure_1PSIDTS")
        )
        await client.init(timeout=timeout, auto_close=False, auto_refresh=False, verbose=debug)

        # Prepend "Generate an image of:" to trigger image generation mode
        generation_prompt = f"Generate an image of: {prompt}"

        if debug:
            print(f"Sending prompt: {generation_prompt}", file=sys.stderr)

        response = await client.generate_content(
            generation_prompt,
            model=Model.G_3_0_PRO
        )

        if response.images:
            if debug:
                print(f"Found {len(response.images)} image(s)", file=sys.stderr)

            output_dir.mkdir(parents=True, exist_ok=True)
            await response.images[0].save(path=str(output_dir), filename=f"{filename}.png")
            filepath = output_dir / f"{filename}.png"

            return {"status": "complete", "filepath": str(filepath)}
        else:
            error_msg = response.text if response.text else "No image returned"
            if debug:
                print(f"No images returned. Text: {error_msg[:200]}", file=sys.stderr)
            return {"status": "error", "error": f"No image generated. Response: {error_msg[:100]}"}

    except Exception as e:
        if debug:
            import traceback
            traceback.print_exc()
        return {"status": "error", "error": str(e)}
    finally:
        if 'client' in locals():
            await client.close()


def main():
    parser = argparse.ArgumentParser(
        description="Generate and edit images using Gemini 3 Pro",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  nanobanana --setup                              Extract cookies from browser
  nanobanana "a sunset over mountains"            Generate image
  nanobanana --edit photo.png "make it vintage"   Edit existing image
  nanobanana --edit img.png "remove background"   Remove background
  nanobanana --json "test prompt"                 JSON output (for agents)
  nanobanana -o logo "company logo"               Custom filename
  nanobanana --timeout 180 "complex scene"        Longer timeout
"""
    )
    parser.add_argument("prompt", nargs="?", help="Image generation/editing prompt")
    parser.add_argument("--setup", action="store_true", help="Extract cookies from browser")
    parser.add_argument("--edit", metavar="IMAGE", help="Edit an existing image (provide path)")
    parser.add_argument("-o", "--output", metavar="NAME", help="Custom filename (no extension)")
    parser.add_argument("-d", "--dir", metavar="PATH", help="Output directory")
    parser.add_argument("--json", action="store_true", help="Output JSON (for programmatic use)")
    parser.add_argument("--timeout", type=int, default=120, help="Timeout in seconds (default: 120)")
    parser.add_argument("--debug", action="store_true", help="Show debug output")

    args = parser.parse_args()

    # Handle setup mode
    if args.setup:
        setup_cookies()
        return

    if not args.prompt:
        parser.error("prompt is required unless using --setup")

    output_dir = Path(args.dir) if args.dir else DEFAULT_OUTPUT_DIR
    filename = args.output if args.output else datetime.now().strftime("%Y%m%d_%H%M%S")

    # Choose between edit and generate modes
    if args.edit:
        input_image = Path(args.edit)
        result = asyncio.run(edit_image(args.prompt, input_image, output_dir, filename, args.timeout, args.debug))
    else:
        result = asyncio.run(generate_image(args.prompt, output_dir, filename, args.timeout, args.debug))

    # Output result
    if args.json:
        print(json.dumps(result))
        if result["status"] == "error":
            sys.exit(EXIT_ERROR)
        else:
            sys.exit(EXIT_SUCCESS)
    else:
        if result["status"] == "complete":
            print(result["filepath"])
            sys.exit(EXIT_SUCCESS)
        else:
            print(f"Error: {result['error']}", file=sys.stderr)
            sys.exit(EXIT_ERROR)


if __name__ == "__main__":
    main()
