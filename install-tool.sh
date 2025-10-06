#!/bin/bash
# Simplified installation script for mr-tools
# All tools are already in bin/ - just need to ensure PATH is set

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

print_color $GREEN "🛠️  Mr Tools Installation"
echo ""

# Check if already in PATH
if echo "$PATH" | grep -q "$BIN_DIR"; then
    print_color $GREEN "✓ $BIN_DIR already in PATH"
else
    print_color $YELLOW "Adding $BIN_DIR to PATH..."

    # Add to .zshrc if it exists
    if [ -f "$HOME/.zshrc" ]; then
        if ! grep -q "mr-tools" "$HOME/.zshrc"; then
            echo "" >> "$HOME/.zshrc"
            echo "# Mr Tools" >> "$HOME/.zshrc"
            echo "export PATH=\"$BIN_DIR:\$PATH\"" >> "$HOME/.zshrc"
            print_color $GREEN "✓ Added to ~/.zshrc"
        fi
    fi

    # Add to .bashrc if it exists
    if [ -f "$HOME/.bashrc" ]; then
        if ! grep -q "mr-tools" "$HOME/.bashrc"; then
            echo "" >> "$HOME/.bashrc"
            echo "# Mr Tools" >> "$HOME/.bashrc"
            echo "export PATH=\"$BIN_DIR:\$PATH\"" >> "$HOME/.bashrc"
            print_color $GREEN "✓ Added to ~/.bashrc"
        fi
    fi

    # Export for current session
    export PATH="$BIN_DIR:$PATH"
fi

echo ""
print_color $GREEN "Available tools:"
ls -1 "$BIN_DIR" | sed 's/^/  - /'

echo ""
print_color $YELLOW "To use tools in current shell:"
print_color $YELLOW "  source ~/.zshrc"
echo ""
print_color $GREEN "Installation complete!"
