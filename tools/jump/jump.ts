#!/usr/bin/env bun
/**
 * jump - Navigate to AI-labeled checkpoints
 *
 * Time travel to any auto-captured checkpoint by label.
 * Uses the unified checkpoint system with rewind.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import {
  getAutoCheckpoints,
  findCheckpointByLabel,
  loadCheckpoints,
  Checkpoint
} from '../../lib/checkpoint.ts';

// ============================================================================
// LIST - Show all auto-captured jumps
// ============================================================================

function listJumps(filepath: string = './.agent-checkpoints.json'): void {
  const jumps = getAutoCheckpoints(filepath);

  if (jumps.length === 0) {
    console.log('No jumps found. Jumps are auto-captured by hooks on every assistant response.');
    return;
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('🚀 JUMPS (Auto-Captured)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  for (const jump of jumps) {
    const date = new Date(jump.timestamp).toLocaleString();
    console.log(`${jump.step}: ${jump.stepName}`);
    console.log(`   ${date}`);
    console.log();
  }

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`Total: ${jumps.length} jumps`);
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

// ============================================================================
// SEARCH - Find jumps by label
// ============================================================================

function searchJumps(query: string, filepath: string = './.agent-checkpoints.json'): void {
  const jumps = getAutoCheckpoints(filepath);
  const results = jumps.filter(jump =>
    jump.stepName.toLowerCase().includes(query.toLowerCase())
  );

  if (results.length === 0) {
    console.log(`No jumps found matching "${query}"`);
    return;
  }

  console.log(`\nFound ${results.length} jump(s):\n`);
  for (const jump of results) {
    console.log(`${jump.step}: ${jump.stepName}`);
    console.log(`   ${new Date(jump.timestamp).toLocaleString()}`);
    console.log();
  }
}

// ============================================================================
// JUMP - Time travel to checkpoint
// ============================================================================

async function jumpTo(
  labelOrId: string,
  question: string = 'Summarize what you just accomplished',
  filepath: string = './.agent-checkpoints.json',
  fullContext: boolean = false
): Promise<void> {
  // Find checkpoint by label
  let checkpoint: Checkpoint | undefined;
  const store = loadCheckpoints(filepath);

  // Try to find by step ID first
  for (const session of Object.values(store)) {
    checkpoint = session.checkpoints.find(cp => cp.step === labelOrId && cp.auto);
    if (checkpoint) {
      // Also need sessionId
      const sessionId = session.sessionId;
      checkpoint = { ...checkpoint, sessionId } as any;
      break;
    }
  }

  // If not found, try by label
  if (!checkpoint) {
    for (const session of Object.values(store)) {
      const matches = session.checkpoints.filter(cp =>
        cp.auto && cp.stepName.toLowerCase().includes(labelOrId.toLowerCase())
      );

      if (matches.length > 0) {
        checkpoint = { ...matches[0], sessionId: session.sessionId } as any;
        break;
      }
    }
  }

  if (!checkpoint) {
    console.error(`No jump found matching "${labelOrId}"`);
    console.error(`\nTry: jump list`);
    return;
  }

  const sessionId = (checkpoint as any).sessionId;

  console.log(`\n🚀 Jumping to: ${checkpoint.stepName}`);
  console.log(`📋 Session: ${sessionId}`);
  console.log(`💬 Message: ${checkpoint.messageId}`);
  console.log(`📝 Question: "${question}"`);
  console.log(`🔍 Mode: ${fullContext ? 'Full Context (with future messages)' : 'Point-in-Time (isolated)'}\n`);

  // Query at checkpoint using same logic as rewind
  try {
    const queryOptions: any = {
      model: 'claude-sonnet-4-5-20250929',
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code'
      },
      settingSources: ['project'],
      resume: sessionId,
      pathToClaudeCodeExecutable: '/Users/pete/.claude/local/claude'
    };

    // Point-in-time: use resumeSessionAt to limit context
    // Full context: don't use resumeSessionAt to see all future messages
    if (!fullContext) {
      queryOptions.resumeSessionAt = checkpoint.messageId;
    }

    const response = query({
      prompt: question,
      options: queryOptions
    });

    let answer = '';
    for await (const msg of response) {
      if (msg.type === 'assistant') {
        const content = Array.isArray(msg.message?.content) ? msg.message.content : [];
        for (const block of content) {
          if (block.type === 'text') {
            answer += block.text;
          }
        }
      }
    }

    console.log('✅ Response:\n');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(answer.trim());
    console.log('═══════════════════════════════════════════════════════════════════\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

// ============================================================================
// CLI
// ============================================================================

function printHelp() {
  console.log(`
jump - Navigate to AI-labeled checkpoints

Usage:
  jump                                    # List all jumps
  jump list                               # List all jumps
  jump search <query>                     # Search jumps by label
  jump <label> [question]                 # Jump to checkpoint (point-in-time)
  jump <label> [question] --full          # Jump with full context
  jump <jump_id> [question]               # Jump by ID

Query Modes:
  Point-in-Time (default): Agent only sees conversation up to checkpoint
  Full Context (--full):   Agent sees entire session including future messages

Examples:
  jump list
  jump search "auth"
  jump "Fixed JWT" "how did you fix it?"           # Point-in-time
  jump "Fixed JWT" "why did you choose this?" --full  # Full context
  jump auto_1728210000

Jumps are auto-captured by hooks on every assistant response.
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '-h' || command === '--help') {
    printHelp();
    return;
  }

  const filepath = './.agent-checkpoints.json';

  switch (command) {
    case 'list':
      listJumps(filepath);
      break;

    case 'search':
      const query = args.slice(1).join(' ');
      if (!query) {
        console.error('Usage: jump search <query>');
        process.exit(1);
      }
      searchJumps(query, filepath);
      break;

    default:
      // Assume it's a label to jump to
      const label = args[0];

      // Check for --full flag
      const fullFlagIndex = args.indexOf('--full');
      const hasFullFlag = fullFlagIndex !== -1;

      // Extract question (everything between label and --full, or all if no --full)
      let questionArgs = args.slice(1);
      if (hasFullFlag) {
        questionArgs = args.slice(1, fullFlagIndex);
      }

      const question = questionArgs.join(' ') || 'Summarize what you just accomplished';
      await jumpTo(label, question, filepath, hasFullFlag);
      break;
  }
}

main().catch(console.error);
