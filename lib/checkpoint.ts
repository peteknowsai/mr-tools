/**
 * Checkpoint Helper Library
 *
 * Projects use this to SAVE checkpoints for the `rewind` tool.
 *
 * Usage in multi-step agent workflows:
 *
 * ```typescript
 * import { saveCheckpoint } from '@mr-tools/checkpoint';
 *
 * // After agent generates response
 * for await (const message of response) {
 *   if (message.type === 'assistant' && message.message?.id) {
 *     saveCheckpoint({
 *       sessionId: 'abc-123',
 *       userId: 'user_001',
 *       dayNumber: 2,
 *       step: 'composition',
 *       stepName: 'Daily Composition Generation',
 *       messageId: message.message.id
 *     });
 *   }
 * }
 * ```
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { query } from '@anthropic-ai/claude-agent-sdk';

export interface Checkpoint {
  dayNumber: number;
  step: string;           // Human-readable ID: "composition", "memory", etc.
  stepName: string;       // Full name: "Daily Composition Generation"
  messageId: string;      // Claude message ID for resumeSessionAt
  timestamp: string;      // ISO timestamp
  auto?: boolean;         // Flag for auto-captured jumps
}

export interface SessionCheckpoints {
  sessionId: string;
  userId: string;
  createdAt: string;
  checkpoints: Checkpoint[];
}

export interface CheckpointStore {
  [sessionId: string]: SessionCheckpoints;
}

export interface SaveCheckpointOptions {
  sessionId: string;
  userId: string;
  dayNumber: number;
  step: string;           // e.g., "composition", "memory", "planning"
  stepName: string;       // e.g., "Daily Composition Generation"
  messageId: string;      // Message ID from Claude response
  filepath?: string;      // Default: ./.agent-checkpoints.json
  auto?: boolean;         // Flag for auto-captured jumps
}

const DEFAULT_CHECKPOINT_FILE = './.agent-checkpoints.json';

/**
 * Save a checkpoint to disk
 *
 * Creates or updates .agent-checkpoints.json with the checkpoint.
 * Overwrites existing checkpoint if same day/step already exists.
 */
export function saveCheckpoint(options: SaveCheckpointOptions): void {
  const filepath = options.filepath || DEFAULT_CHECKPOINT_FILE;
  const store = loadCheckpoints(filepath);

  if (!store[options.sessionId]) {
    store[options.sessionId] = {
      sessionId: options.sessionId,
      userId: options.userId,
      createdAt: new Date().toISOString(),
      checkpoints: []
    };
  }

  // Check if checkpoint already exists
  const existing = store[options.sessionId].checkpoints.find(
    cp => cp.dayNumber === options.dayNumber && cp.step === options.step
  );

  if (existing) {
    // Update existing
    existing.messageId = options.messageId;
    existing.stepName = options.stepName;
    existing.timestamp = new Date().toISOString();
    if (options.auto !== undefined) {
      existing.auto = options.auto;
    }
  } else {
    // Add new
    const checkpoint: Checkpoint = {
      dayNumber: options.dayNumber,
      step: options.step,
      stepName: options.stepName,
      messageId: options.messageId,
      timestamp: new Date().toISOString()
    };
    if (options.auto !== undefined) {
      checkpoint.auto = options.auto;
    }
    store[options.sessionId].checkpoints.push(checkpoint);
  }

  saveCheckpoints(store, filepath);
}

/**
 * Load all checkpoints from file
 */
export function loadCheckpoints(filepath: string = DEFAULT_CHECKPOINT_FILE): CheckpointStore {
  if (!existsSync(filepath)) {
    return {};
  }
  const content = readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Save checkpoints to file
 */
export function saveCheckpoints(
  checkpoints: CheckpointStore,
  filepath: string = DEFAULT_CHECKPOINT_FILE
): void {
  writeFileSync(filepath, JSON.stringify(checkpoints, null, 2), 'utf-8');
}

/**
 * Get checkpoint for a specific day and step
 */
export function getCheckpoint(
  sessionId: string,
  dayNumber: number,
  step: string,
  filepath: string = DEFAULT_CHECKPOINT_FILE
): Checkpoint | undefined {
  const store = loadCheckpoints(filepath);
  const session = store[sessionId];
  if (!session) return undefined;

  return session.checkpoints.find(
    cp => cp.dayNumber === dayNumber && cp.step === step
  );
}

/**
 * Get all checkpoints for a session
 */
export function getSessionCheckpoints(
  sessionId: string,
  filepath: string = DEFAULT_CHECKPOINT_FILE
): Checkpoint[] {
  const store = loadCheckpoints(filepath);
  const session = store[sessionId];
  return session?.checkpoints || [];
}

/**
 * Common step names for Captain32 agents
 * Other projects can define their own
 */
export const CAPTAIN32_STEPS = {
  composition: 'Daily Composition Generation',
  memory: 'Memory Update',
  system: 'System Prompt Evolution',
  planning: 'User Prompt Planning'
} as const;

/**
 * Example: Generic step names
 */
export const GENERIC_STEPS = {
  step1: 'Step 1',
  step2: 'Step 2',
  step3: 'Step 3',
  step4: 'Step 4'
} as const;

/**
 * Auto-capture checkpoint with AI-generated label
 * Used by jump system via hooks
 */
export interface AutoCaptureOptions {
  sessionId: string;
  userId: string;
  messageId: string;
  transcriptPath: string;
  filepath?: string;
}

export async function saveAutoCheckpoint(options: AutoCaptureOptions): Promise<void> {
  // Read last 5 messages for context
  const lines = readFileSync(options.transcriptPath, 'utf-8').split('\n').filter(Boolean);
  const recentMessages = lines.slice(-5).map(line => JSON.parse(line));

  // Build context for label generation
  const context = recentMessages
    .map(msg => {
      if (msg.type === 'user') {
        const content = typeof msg.message?.content === 'string'
          ? msg.message.content
          : msg.message?.content || '';
        return `User: ${content}`.substring(0, 300);
      } else if (msg.type === 'assistant') {
        const text = msg.message?.content?.[0]?.text || '';
        return `Assistant: ${text}`.substring(0, 300);
      }
      return '';
    })
    .filter(Boolean)
    .join('\n\n');

  // Generate label with Sonnet 4.5
  const labelPrompt = `Based on this recent conversation, create a SHORT (5-10 word) label describing what was just accomplished.

Focus on WHAT was done, not HOW. Be specific and actionable.

Context:
${context}

Label:`;

  let label = '';
  try {
    const response = query({
      prompt: labelPrompt,
      options: {
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 50,
        pathToClaudeCodeExecutable: '/Users/pete/.claude/local/claude'
      }
    });

    for await (const msg of response) {
      if (msg.type === 'assistant') {
        const content = msg.message?.content || [];
        for (const block of content) {
          if (block.type === 'text') {
            label += block.text;
          }
        }
      }
    }

    label = label.trim().replace(/^["']|["']$/g, ''); // Remove quotes
  } catch (error) {
    console.error('Failed to generate label:', error);
    label = 'Jump ' + new Date().toISOString();
  }

  // Use existing saveCheckpoint function
  saveCheckpoint({
    sessionId: options.sessionId,
    userId: options.userId,
    dayNumber: 0,  // Auto-captured don't have day concept
    step: `auto_${Date.now()}`,
    stepName: label,
    messageId: options.messageId,
    filepath: options.filepath,
    auto: true
  });
}

/**
 * Find checkpoint by label (partial match)
 */
export function findCheckpointByLabel(
  label: string,
  filepath: string = DEFAULT_CHECKPOINT_FILE
): Checkpoint | undefined {
  const store = loadCheckpoints(filepath);

  for (const session of Object.values(store)) {
    const matches = session.checkpoints.filter(cp =>
      cp.stepName.toLowerCase().includes(label.toLowerCase())
    );

    if (matches.length > 0) {
      return matches[0]; // Return first match
    }
  }

  return undefined;
}

/**
 * Get all auto-captured jumps
 */
export function getAutoCheckpoints(
  filepath: string = DEFAULT_CHECKPOINT_FILE
): Checkpoint[] {
  const store = loadCheckpoints(filepath);
  const jumps: Checkpoint[] = [];

  for (const session of Object.values(store)) {
    jumps.push(...session.checkpoints.filter(cp => cp.auto));
  }

  return jumps.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
