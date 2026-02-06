# select_card

CLI tool for Captain32 Editor-in-Chief to select cards for publication.

## Purpose

Editor agent reviews submitted cards and selects the best ones for the final conversation. Each selection includes a rationale explaining why the card was chosen.

## Installation

```bash
# From mr-tools root
bun build ./tools/select-card/select-card.ts --compile --outfile ./bin/select_card
./install-tool.sh select_card
```

## Usage

```bash
# Select a card with rationale
select_card fuel_system_day2 "Maintenance has 100% engagement rate"

# Select another card (appends to selections.json)
select_card fishing_tactics_day2 "Fishing validated by user interest"

# Rationale can be multi-word (auto-joined)
select_card weather_alert_day2 "Storm warning is time-critical information"
```

## Output

**Success:**
```
✅ Selected: fuel_system_day2
📝 Rationale: Maintenance has 100% engagement rate
📁 /tmp/captain32-cards/selections.json
```

**Error:**
```
❌ Error: Validation failed:
  - card_id: Card ID is required
  - rationale: Rationale is required
```

## File Format

Appends to `/tmp/captain32-cards/selections.json` as JSON array:

```json
[
  {
    "card_id": "fuel_system_day2",
    "rationale": "Maintenance has 100% engagement rate"
  },
  {
    "card_id": "fishing_tactics_day2",
    "rationale": "Fishing validated by user interest"
  }
]
```

## Behavior

- **First call**: Creates file with array containing first selection
- **Subsequent calls**: Appends to array
- **session-manager**: Reads file after editor completes, then deletes it

## Validation Rules

- **card_id**: Non-empty string
- **rationale**: Non-empty string

## Use Cases

**Editor workflow:**
```typescript
// Review all submitted cards
const cards = await readCardsFromTemp();

// Select top 3-5 cards
for (const card of selectedCards) {
  await $`select_card ${card.id} ${card.selectionReason}`;
}

// session-manager reads selections.json and continues pipeline
```

## Integration with Pipeline

Part of the Captain32 newsroom pipeline:

1. Beat reporters → `submit_card` → `/tmp/captain32-cards/*.json`
2. Editor → `select_card` → `/tmp/captain32-cards/selections.json`
3. Captain's Advisor → processes selected cards
4. Assembly → `add_item` → `/tmp/captain32-cards/assembly.json`
5. session-manager → reads all files, builds conversation, cleans up
