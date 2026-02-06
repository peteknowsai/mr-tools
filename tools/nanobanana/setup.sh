#!/bin/bash
# Setup script for nanobanana and geminipro tools
# Creates a Python virtual environment and installs dependencies

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/.venv"

echo "Setting up nanobanana tools..."
echo "  Directory: ${SCRIPT_DIR}"
echo "  Virtual env: ${VENV_DIR}"

# Create virtual environment if it doesn't exist
if [ ! -d "${VENV_DIR}" ]; then
    echo ""
    echo "Creating virtual environment..."
    python3 -m venv "${VENV_DIR}"
fi

# Activate and install dependencies
echo ""
echo "Installing dependencies..."
"${VENV_DIR}/bin/pip" install --upgrade pip -q
"${VENV_DIR}/bin/pip" install -r "${SCRIPT_DIR}/requirements.txt" -q

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Run 'nanobanana --setup' to extract cookies from Chrome"
echo "  2. Test with 'nanobanana \"a friendly robot\"'"
echo ""
echo "Tools available:"
echo "  - nanobanana  (image generation)"
echo "  - geminipro   (text generation with Gemini 3 Pro)"
