# Jump System - Setup Complete

## What Was Built

The **Jump system** - automatic checkpoint navigation with AI-generated labels. It's a unified system that works alongside `rewind`.

## Files Created

1. **Enhanced checkpoint library** - `lib/checkpoint.ts`
   - Added `saveAutoCheckpoint()` - Auto-capture with AI labels
   - Added `findCheckpointByLabel()` - Search by partial match
   - Added `getAutoCheckpoints()` - Filter auto-captured jumps
   - Added `auto` flag to Checkpoint interface

2. **Auto-capture CLI** - `tools/checkpoint-auto-capture.ts`
   - Called by hooks to capture checkpoints
   - Generates AI labels using Sonnet 4.5
   - Saves to unified registry

3. **Jump navigation tool** - `tools/jump/jump.ts`
   - `jump list` - Show all auto-captured jumps
   - `jump search <query>` - Find by label
   - `jump <label>` - Time travel with question

4. **Hook script** - `hooks/auto-jump.sh`
   - Runs on Stop hook (after every response)
   - Extracts session/message IDs from transcript
   - Calls checkpoint-auto-capture in background

5. **Documentation** - Updated `CLAUDE.md`
   - Complete jump system documentation
   - Usage examples
   - Integration with rewind

## Installation Status

✅ **Binaries built and installed:**
- `/Users/pete/.local/bin/checkpoint-auto-capture`
- `/Users/pete/.local/bin/jump`

✅ **Hook installed:**
- `~/.claude/hooks/auto-jump.sh`

## To Enable Auto-Capture

Add this to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/auto-jump.sh"
          }
        ]
      }
    ]
  }
}
```

**Important:** Restart Claude Code after adding the hook!

## Testing

After restart, test with:

```bash
# In any project directory
jump list                    # Should show "No jumps found" initially

# After working for a bit:
jump list                    # Should show auto-captured jumps
jump search "your topic"     # Search jumps
jump "partial label"         # Time travel
```

## How It Works

1. **You work in Claude Code** → Create files, fix bugs, etc.
2. **Claude responds** → Stop hook triggers
3. **AI generates label** → "Fixed JWT validation bug"
4. **Saved to registry** → `.agent-checkpoints.json` with `auto: true`
5. **Navigate anytime** → `jump "JWT bug"` to go back

## Unified with Rewind

**Same registry file** (`.agent-checkpoints.json`):
- Manual checkpoints: `rewind day2 memory`
- Auto jumps: `jump "Fixed bug"`

Both coexist peacefully!

## Next Steps

1. **Add hook to settings.json**
2. **Restart Claude Code**
3. **Work normally** - jumps auto-capture
4. **Try `jump list`** to see captured jumps

---

Ready to test! Restart your Claude Code session and the hook will start capturing jumps automatically.
