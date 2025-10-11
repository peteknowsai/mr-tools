#!/bin/bash
# Simplified installation script for mr-tools
# Moves compiled binaries from bin/ to ~/.local/bin/ to avoid Claude Code checkpoint bloat

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_color() {
    color=$1
    shift
    echo -e "${color}$@${NC}"
}

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BIN_DIR="$SCRIPT_DIR/bin"
LOCAL_BIN="$HOME/.local/bin"

print_color $GREEN "🛠️  Mr Tools Installation"
echo ""

# Create .local/bin if it doesn't exist
if [ ! -d "$LOCAL_BIN" ]; then
    mkdir -p "$LOCAL_BIN"
    print_color $GREEN "✓ Created $LOCAL_BIN"
fi

# Ensure .local/bin is in PATH
if echo "$PATH" | grep -q "$LOCAL_BIN"; then
    print_color $GREEN "✓ $LOCAL_BIN already in PATH"
else
    print_color $YELLOW "Adding $LOCAL_BIN to PATH..."

    # Add to .zshrc if it exists
    if [ -f "$HOME/.zshrc" ]; then
        if ! grep -q ".local/bin" "$HOME/.zshrc"; then
            echo "" >> "$HOME/.zshrc"
            echo "# Mr Tools (.local/bin for compiled binaries)" >> "$HOME/.zshrc"
            echo "export PATH=\"$LOCAL_BIN:\$PATH\"" >> "$HOME/.zshrc"
            print_color $GREEN "✓ Added to ~/.zshrc"
        fi
    fi

    # Add to .bashrc if it exists
    if [ -f "$HOME/.bashrc" ]; then
        if ! grep -q ".local/bin" "$HOME/.bashrc"; then
            echo "" >> "$HOME/.bashrc"
            echo "# Mr Tools (.local/bin for compiled binaries)" >> "$HOME/.bashrc"
            echo "export PATH=\"$LOCAL_BIN:\$PATH\"" >> "$HOME/.bashrc"
            print_color $GREEN "✓ Added to ~/.bashrc"
        fi
    fi

    # Export for current session
    export PATH="$LOCAL_BIN:$PATH"
fi

# Move tool from bin/ to .local/bin/ if provided as argument
if [ -n "$1" ]; then
    TOOL_NAME="$1"
    if [ -f "$BIN_DIR/$TOOL_NAME" ]; then
        mv "$BIN_DIR/$TOOL_NAME" "$LOCAL_BIN/$TOOL_NAME"
        chmod +x "$LOCAL_BIN/$TOOL_NAME"
        print_color $GREEN "✓ Moved $TOOL_NAME to $LOCAL_BIN (prevents Claude Code checkpoint bloat)"
    else
        print_color $YELLOW "⚠ Tool '$TOOL_NAME' not found in $BIN_DIR"
        print_color $YELLOW "   (May already be installed in $LOCAL_BIN)"
    fi
fi

echo ""
print_color $GREEN "Installed tools in $LOCAL_BIN:"
echo ""
if [ -d "$LOCAL_BIN" ] && [ "$(ls -A "$LOCAL_BIN" 2>/dev/null)" ]; then
    ls -1 "$LOCAL_BIN" 2>/dev/null | sed 's/^/    /' || echo "    (none yet)"
else
    echo "    (none yet)"
fi

echo ""
print_color $YELLOW "To use tools in current shell:"
print_color $YELLOW "  source ~/.zshrc"
echo ""
print_color $GREEN "Installation complete!"
