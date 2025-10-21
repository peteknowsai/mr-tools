# add_item

CLI tool for Captain32 Assembly agent to build final conversation items.

## Purpose

Assembly agent constructs the final conversation by adding items one by one. Items can be text, image cards, surveys, or other conversation elements.

## Installation

```bash
# From mr-tools root
bun build ./tools/add-item/add-item.ts --compile --outfile ./bin/add_item
./install-tool.sh add_item
```

## Usage

```bash
# Add text item
add_item <<'EOF'
{"type": "text", "content": "Good morning, Captain Pete!"}
EOF

# Add image card
add_item <<'EOF'
{
  "type": "image_card",
  "id": "fuel_system_day2",
  "title": "Fuel System Protection",
  "subtext": "Florida's ethanol fuel attacks marine engines...",
  "content_markdown": "# Boston Whaler 230 Fuel System Care\n\n...",
  "image": "https://imagedelivery.net/7NA-8FN5mTUANBxov63ekA/abc123/public",
  "backgroundColor": "#1e3a8a",
  "theme": "maintenance"
}
EOF

# Add text input prompt
add_item <<'EOF'
{"type": "text_input", "prompt": "What's your fuel consumption today?"}
EOF
```

## Output

**Success:**
```
✅ Added item: text
📁 /tmp/captain32-cards/assembly.json (item 1 of N)

✅ Added item: image_card
📁 /tmp/captain32-cards/assembly.json (item 2 of N)
```

**Error:**
```
❌ Error: Validation failed:
  - type: Type must be one of: text, image_card, text_input, survey, multi_select_survey, image_upload
```

## File Format

Appends to `/tmp/captain32-cards/assembly.json` as items array:

```json
{
  "items": [
    {"type": "text", "content": "Good morning, Captain Pete!"},
    {
      "type": "image_card",
      "id": "fuel_system_day2",
      "title": "Fuel System Protection",
      "subtext": "Florida's ethanol fuel attacks marine engines...",
      "content_markdown": "# Boston Whaler 230 Fuel System Care\n\n...",
      "image": "https://imagedelivery.net/7NA-8FN5mTUANBxov63ekA/abc123/public",
      "backgroundColor": "#1e3a8a",
      "theme": "maintenance"
    },
    {"type": "text", "content": "Tight lines!"}
  ]
}
```

## Behavior

- **First call**: Creates file with items array containing first item
- **Subsequent calls**: Appends to items array
- **session-manager**: Reads file after assembly completes, then deletes it

## Validation Rules

Minimal validation (full validation happens in session-manager):

- **type**: Must be one of: `text`, `image_card`, `text_input`, `survey`, `multi_select_survey`, `image_upload`
- Additional fields: Passed through without validation (validated later)

## Supported Item Types

- **text**: Simple text message
- **image_card**: Card with image and markdown content
- **text_input**: Prompt for user text input
- **survey**: Single-choice survey
- **multi_select_survey**: Multiple-choice survey
- **image_upload**: Prompt for user image upload

## Use Cases

**Assembly workflow:**
```typescript
// 1. Opening greeting
await $`add_item <<'EOF'
{"type": "text", "content": "Good morning, Captain Pete!"}
EOF`;

// 2. Add selected cards
for (const card of selectedCards) {
  await $`add_item <<'EOF'
  ${JSON.stringify(card)}
  EOF`;
}

// 3. Closing message
await $`add_item <<'EOF'
{"type": "text", "content": "Tight lines!"}
EOF`;

// session-manager reads assembly.json and builds final conversation
```

## Integration with Pipeline

Part of the Captain32 newsroom pipeline:

1. Beat reporters → `submit_card` → `/tmp/captain32-cards/*.json`
2. Editor → `select_card` → `/tmp/captain32-cards/selections.json`
3. Captain's Advisor → processes selected cards
4. Assembly → `add_item` → `/tmp/captain32-cards/assembly.json`
5. session-manager → reads all files, builds conversation, cleans up
