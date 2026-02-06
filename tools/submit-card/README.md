# submit_card

CLI tool for Captain32 beat reporters to submit completed cards to session-manager.

## Purpose

Beat reporters (boat_maintenance, fishing_reports, weather_conditions, maritime_news) use this tool to submit validated ImageCardItem JSON to the session-manager for assembly into daily conversations.

## Installation

```bash
# From mr-tools root
bun build ./tools/submit-card/submit-card.ts --compile --outfile ./bin/submit_card
./install-tool.sh submit_card
```

## Usage

**IMPORTANT:** The `--reporter` argument is **required**. This eliminates circular dependency (agent knows its name, no need to include in JSON).

```bash
# Submit card with explicit reporter
submit_card --reporter boat_maintenance <<'EOF'
{
  "id": "fuel_system_day2",
  "type": "image_card",
  "title": "Fuel System Protection",
  "subtext": "Florida's ethanol fuel attacks marine engines. Simple monthly checks prevent costly repairs.",
  "content_markdown": "# Boston Whaler 230 Fuel System Care\n\nFlorida's E10 fuel is tough on engines. Here's how to protect your Whaler.\n\n## The Ethanol Problem\n\n- E10 fuel attracts water\n- Water causes corrosion\n- Cost to repair: $800-2,000\n\n## Your Protection Plan\n\n**Every fill-up:**\n- Add fuel stabilizer\n- Check for water separation\n- Inspect fuel lines\n\n**Monthly:**\n- Replace fuel filters\n- Drain water separator\n- Test fuel quality\n\nThese simple steps prevent expensive engine damage and keep your Whaler running smoothly.",
  "image": "https://imagedelivery.net/7NA-8FN5mTUANBxov63ekA/abc123/public",
  "backgroundColor": "#1e3a8a",
  "theme": "maintenance",
  "metadata": {
    "reporter": "boat_maintenance",
    "topics": ["fuel_system", "ethanol"]
  }
}
EOF
```

## Output

**Success:**
```
✅ Card submitted: fuel_system_day2
📁 /tmp/captain32-cards/1761001234567_boat_maintenance.json
```

**Missing --reporter:**
```
❌ Error: --reporter argument is required

Valid reporters: boat_maintenance, fishing_reports, weather_conditions, maritime_news
```

**Validation Error:**
```
❌ Error: Validation failed:
  - type: Invalid input: expected "image_card"
  - title: Title must be at least 3 characters
  - subtext: Subtext must be at least 20 characters
  - content_markdown: Content markdown must be at least 100 characters
  - image: Image must be a Cloudflare Images URL
  - backgroundColor: Background color must be a valid hex color
```

## Validation Rules

Matches `@peteknowsai/types` ImageCardItem interface (v3.0.0):

- **id**: Non-empty string
- **type**: Must be literal `"image_card"`
- **title**: 3-50 characters
- **subtext**: 20-300 characters (short preview shown on card front)
- **content_markdown**: At least 100 characters (full content shown when card is tapped)
- **image**: Valid URL starting with `https://imagedelivery.net/` (Cloudflare Images)
- **backgroundColor** (optional): Valid hex color (e.g., `#1e3a8a`)
- **theme** (optional): One of `maintenance`, `weather`, `community`, `navigation`, `scenic`, `welcome`
- **metadata** (optional): Object with optional `reporter` (string) and `topics` (string array)

## File Storage

Cards are stored in `/tmp/captain32-cards/` with filename format:
```
{timestamp}_{reporter}.json
```

Example: `1761001234567_boat_maintenance.json`

## Integration with Session Manager

Session-manager polls `/tmp/captain32-cards/` to collect submitted cards and assembles them into the daily conversation.

## Error Handling

- **No input**: Exits with error and usage instructions
- **Invalid JSON**: Reports parsing error
- **Validation failure**: Lists all validation errors with field paths
- **File write error**: Reports filesystem error

## Use Cases

**Beat Reporter workflow:**
```typescript
// 1. Beat reporter knows its own name
const REPORTER = "boat_maintenance";

// 2. Generate card content matching @peteknowsai/types
const card = {
  id: `fuel_system_day${day}`,
  type: "image_card",
  title: "Fuel System Protection",
  subtext: "Florida's ethanol fuel attacks marine engines. Simple monthly checks prevent costly repairs.",
  content_markdown: await generateContentMarkdown(),
  image: await generateCardArt("fuel system maintenance", { theme: "maintenance" }),
  backgroundColor: "#1e3a8a",
  theme: "maintenance"
};

// 3. Submit with explicit reporter (no circular dependency!)
const result = await $`submit_card --reporter ${REPORTER} <<'EOF'
${JSON.stringify(card)}
EOF`;

// 4. Parse output for confirmation
console.log(result.stdout); // ✅ Card submitted: fuel_system_day2
```
