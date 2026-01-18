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
import re
import sys
from datetime import datetime
from pathlib import Path

import httpx

# Config paths
CONFIG_DIR = Path.home() / ".nanobanana"
COOKIE_FILE = CONFIG_DIR / "cookies.json"
DEFAULT_OUTPUT_DIR = CONFIG_DIR / "images"

# Exit codes
EXIT_SUCCESS = 0
EXIT_ERROR = 1

# Gemini endpoints
GEMINI_HOST = "gemini.google.com"
STREAM_GENERATE_URL = f"https://{GEMINI_HOST}/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate"

# Model header for image generation - UPDATED FORMAT
# Based on gemini-webapi PR #209: https://github.com/HanaokaYuzu/Gemini-API/pull/209
# Old format "[4]" stopped working - new format includes additional metadata
MODEL_HEADER = {"x-goog-ext-525001261-jspb": '[1,null,null,null,"9d8ca3786ebdfbea",null,null,0,[4],null,null,2]'}


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


def build_request_body(prompt: str, access_token: str) -> str:
    """Build the StreamGenerate request body with updated parameters."""
    import orjson

    # Build the inner request structure
    inner = orjson.dumps([
        [prompt],  # Prompt array
        None,      # Files placeholder
        None,      # Chat metadata placeholder
    ]).decode()

    outer = orjson.dumps([None, inner]).decode()

    # Include new payload parameters from PR #209
    # idx17=[[1]] enables image generation mode
    # idx49=14 sets the generation parameters
    return f"at={access_token}&f.req={outer}&idx17=%5B%5B1%5D%5D&idx49=14"


def parse_streaming_response(data: str) -> list:
    """Parse streaming response chunks and unpack nested JSON strings."""
    results = []

    # Remove the leading ")]}'" if present (Google's XSSI protection)
    if data.startswith(")]}'"):
        data = data[4:]

    lines = data.strip().split('\n')

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        # Lines starting with numbers are byte counts for the next line
        if line.isdigit():
            if i + 1 < len(lines):
                json_line = lines[i + 1]
                try:
                    parsed = json.loads(json_line)
                    # Unpack nested JSON structures
                    unpacked = unpack_nested_json(parsed)
                    results.append(unpacked)
                except json.JSONDecodeError:
                    pass
            i += 2
        else:
            # Try to parse as JSON directly
            try:
                parsed = json.loads(line)
                unpacked = unpack_nested_json(parsed)
                results.append(unpacked)
            except json.JSONDecodeError:
                pass
            i += 1

    return results


def unpack_nested_json(obj, depth=0):
    """Recursively unpack JSON strings within the structure."""
    if depth > 10:
        return obj

    if isinstance(obj, str):
        # Try to parse as JSON
        if obj.startswith('[') or obj.startswith('{'):
            try:
                parsed = json.loads(obj)
                return unpack_nested_json(parsed, depth + 1)
            except json.JSONDecodeError:
                return obj
        return obj
    elif isinstance(obj, list):
        return [unpack_nested_json(item, depth + 1) for item in obj]
    elif isinstance(obj, dict):
        return {k: unpack_nested_json(v, depth + 1) for k, v in obj.items()}
    else:
        return obj


def extract_image_urls(parsed_chunks: list) -> list:
    """Extract image URLs from parsed response chunks."""
    image_urls = []

    for chunk in parsed_chunks:
        urls = find_image_urls_recursive(chunk)
        image_urls.extend(urls)

    return list(set(image_urls))  # Deduplicate


def find_image_urls_recursive(obj, depth=0) -> list:
    """Recursively find image URLs in nested structure."""
    if depth > 30:
        return []

    urls = []

    if isinstance(obj, str):
        # Only match actual URLs that start with https://
        if obj.startswith("https://lh3.googleusercontent.com/gg-dl/"):
            urls.append(obj)
        elif obj.startswith("https://") and "googleusercontent.com" in obj:
            urls.append(obj)
    elif isinstance(obj, list):
        for item in obj:
            urls.extend(find_image_urls_recursive(item, depth + 1))
    elif isinstance(obj, dict):
        for value in obj.values():
            urls.extend(find_image_urls_recursive(value, depth + 1))

    return urls


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


async def generate_image_streaming(prompt: str, output_dir: Path, filename: str, timeout: int = 120, debug: bool = False) -> dict:
    """Generate image using gemini-webapi for auth, then direct StreamGenerate calls."""
    try:
        from gemini_webapi import GeminiClient
        from gemini_webapi.constants import Headers
    except ImportError:
        return {"status": "error", "error": "gemini-webapi not installed. Run: pip install gemini-webapi"}

    cookies = load_cookies()
    if not cookies:
        return {"status": "error", "error": "No cookies. Run: nanobanana --setup"}

    if "Secure_1PSID" not in cookies:
        return {"status": "error", "error": "Invalid cookies. Run: nanobanana --setup"}

    try:
        # Use gemini-webapi for authentication
        if debug:
            print("Initializing GeminiClient for auth...", file=sys.stderr)

        client = GeminiClient(
            secure_1psid=cookies["Secure_1PSID"],
            secure_1psidts=cookies.get("Secure_1PSIDTS")
        )
        await client.init(timeout=60, auto_close=False, auto_refresh=False, verbose=debug)

        access_token = client.access_token
        valid_cookies = client.cookies

        if debug:
            print(f"Got access token: {access_token[:20]}...", file=sys.stderr)
            print(f"Got cookies: {list(valid_cookies.keys())}", file=sys.stderr)

        # Now make our own streaming request with updated headers
        base_headers = dict(Headers.GEMINI.value)
        headers = {**base_headers, **MODEL_HEADER}

        body = build_request_body(prompt, access_token)

        if debug:
            print(f"Sending streaming request...", file=sys.stderr)
            print(f"Model header: {MODEL_HEADER}", file=sys.stderr)

        accumulated_data = ""
        image_urls = []

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(timeout),
            follow_redirects=True,
            cookies=valid_cookies,
        ) as http_client:
            async with http_client.stream("POST", STREAM_GENERATE_URL, headers=headers, content=body) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    if debug:
                        print(f"Error response: {error_text[:500]}", file=sys.stderr)
                    return {"status": "error", "error": f"HTTP {response.status_code}: {response.reason_phrase}"}

                if debug:
                    print("Streaming response...", file=sys.stderr)

                chunk_count = 0
                async for chunk in response.aiter_text():
                    accumulated_data += chunk
                    chunk_count += 1

                    # Progress indicator
                    if debug and chunk_count % 5 == 0:
                        print(f"  Received {len(accumulated_data)} bytes...", file=sys.stderr)

                    # Check for image URLs periodically
                    if len(accumulated_data) % 10000 < len(chunk):
                        parsed = parse_streaming_response(accumulated_data)
                        urls = extract_image_urls(parsed)
                        if urls:
                            image_urls = urls
                            if debug:
                                print(f"  Found {len(urls)} image URL(s)", file=sys.stderr)

            if debug:
                print(f"Stream complete. Total: {len(accumulated_data)} bytes", file=sys.stderr)
                # Save debug output
                debug_file = output_dir / f"{filename}_debug.txt"
                output_dir.mkdir(parents=True, exist_ok=True)
                debug_file.write_text(accumulated_data)
                print(f"Debug saved to {debug_file}", file=sys.stderr)

            # Final parse
            if not image_urls:
                parsed = parse_streaming_response(accumulated_data)
                image_urls = extract_image_urls(parsed)

            if not image_urls:
                if "Loading Nano Banana Pro" in accumulated_data:
                    return {"status": "error", "error": "Image generation timed out. Try longer --timeout"}
                if "I can search for images" in accumulated_data:
                    return {"status": "error", "error": "Image generation failed - API returned search mode instead of generation. Cookies may need refresh."}
                if debug:
                    print("No image URLs found", file=sys.stderr)
                return {"status": "error", "error": "No image URLs found in response"}

            if debug:
                print(f"Found {len(image_urls)} image URL(s):", file=sys.stderr)
                for url in image_urls[:3]:
                    print(f"  {url[:80]}...", file=sys.stderr)

            # Download image
            image_url = image_urls[0]
            img_response = await http_client.get(image_url)
            if img_response.status_code != 200:
                return {"status": "error", "error": f"Failed to download image: HTTP {img_response.status_code}"}

            output_dir.mkdir(parents=True, exist_ok=True)
            filepath = output_dir / f"{filename}.png"
            filepath.write_bytes(img_response.content)

            return {"status": "complete", "filepath": str(filepath)}

    except httpx.TimeoutException:
        return {"status": "error", "error": f"Request timed out after {timeout}s"}
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
        result = asyncio.run(generate_image_streaming(args.prompt, output_dir, filename, args.timeout, args.debug))

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
