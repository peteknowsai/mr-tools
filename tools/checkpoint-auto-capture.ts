#!/usr/bin/env bun
/**
 * checkpoint-auto-capture - Auto-capture checkpoints with AI labels
 *
 * Called by hooks to automatically save checkpoints with AI-generated labels.
 * Uses the unified checkpoint system from lib/checkpoint.ts
 */

import { saveAutoCheckpoint } from '../lib/checkpoint.ts';

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const options: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    options[key] = args[i + 1];
  }

  const { session, message, transcript, project } = options;

  if (!session || !message || !transcript) {
    console.error('Usage: checkpoint-auto-capture --session <id> --message <id> --transcript <path>');
    process.exit(1);
  }

  try {
    await saveAutoCheckpoint({
      sessionId: session,
      userId: 'auto',
      messageId: message,
      transcriptPath: transcript,
      filepath: project ? `${project}/.agent-checkpoints.json` : undefined
    });
  } catch (error) {
    console.error('Error capturing checkpoint:', error);
    process.exit(1);
  }
}

main();
