#!/usr/bin/env bun
/**
 * rewind - Time machine for Claude Code sessions
 *
 * Query an agent at any specific point in its conversation history.
 *
 * Usage:
 *   rewind                                    # List checkpoints
 *   rewind day2 memory                        # Get summary of checkpoint
 *   rewind day2 memory "what did you learn?"  # Query at checkpoint
 *   rewind day2 memory "why?" --full          # Query with full context
 *   rewind all "how did you evolve?"          # Query all checkpoints
 *
 * Session inference:
 *   - Looks for .agent-checkpoints.json in current directory
 *   - Uses most recent session by default
 *   - Override with: rewind -s SESSION_ID ...
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ============================================================================
// CHECKPOINT MANAGER (Inlined)
// ============================================================================

interface Checkpoint {
  dayNumber: number;
  step: string | number;  // String ("composition") or number (1, 2, 3)
  stepName: string;       // Full name: "Daily Composition Generation"
  messageId: string;
  timestamp: string;
}

// Step name mappings (supports both formats)
const STEP_MAP: Record<string, number> = {
  composition: 1,
  memory: 2,
  system: 3,
  planning: 4
};

const REVERSE_STEP_MAP: Record<number, string> = {
  1: 'composition',
  2: 'memory',
  3: 'system',
  4: 'planning'
};

interface SessionCheckpoints {
  sessionId: string;
  userId: string;
  createdAt: string;
  checkpoints: Checkpoint[];
}

interface CheckpointStore {
  [sessionId: string]: SessionCheckpoints;
}

const DEFAULT_CHECKPOINT_FILE = './.agent-checkpoints.json';

function loadCheckpoints(filepath: string = DEFAULT_CHECKPOINT_FILE): CheckpointStore {
  if (!existsSync(filepath)) {
    return {};
  }
  const content = readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
}

function saveCheckpoints(checkpoints: CheckpointStore, filepath: string = DEFAULT_CHECKPOINT_FILE): void {
  writeFileSync(filepath, JSON.stringify(checkpoints, null, 2), 'utf-8');
}

function getSessionCheckpoints(sessionId: string, filepath: string = DEFAULT_CHECKPOINT_FILE): Checkpoint[] {
  const store = loadCheckpoints(filepath);
  const session = store[sessionId];
  return session?.checkpoints || [];
}

function normalizeStep(step: string | number): string | number {
  // If number, convert to string name
  if (typeof step === 'number') {
    return REVERSE_STEP_MAP[step] || step;
  }
  return step;
}

function getCheckpoint(
  sessionId: string,
  dayNumber: number,
  step: string,
  filepath: string = DEFAULT_CHECKPOINT_FILE
): Checkpoint | undefined {
  const store = loadCheckpoints(filepath);
  const session = store[sessionId];
  if (!session) return undefined;

  // Try to find by string name first
  let found = session.checkpoints.find(
    cp => cp.dayNumber === dayNumber && String(cp.step) === step
  );

  // If not found and step is a known name, try numeric
  if (!found && STEP_MAP[step]) {
    found = session.checkpoints.find(
      cp => cp.dayNumber === dayNumber && cp.step === STEP_MAP[step]
    );
  }

  return found;
}

function getMostRecentSession(filepath: string = DEFAULT_CHECKPOINT_FILE): string | null {
  const store = loadCheckpoints(filepath);
  const sessions = Object.values(store);

  if (sessions.length === 0) return null;

  // Sort by most recent checkpoint timestamp
  sessions.sort((a, b) => {
    const aLatest = a.checkpoints.length > 0
      ? new Date(a.checkpoints[a.checkpoints.length - 1].timestamp).getTime()
      : new Date(a.createdAt).getTime();
    const bLatest = b.checkpoints.length > 0
      ? new Date(b.checkpoints[b.checkpoints.length - 1].timestamp).getTime()
      : new Date(b.createdAt).getTime();
    return bLatest - aLatest;
  });

  return sessions[0].sessionId;
}

// ============================================================================
// REWIND NAVIGATOR
// ============================================================================

class Rewind {
  private sessionId: string;
  private checkpointFile: string;

  constructor(sessionId: string, checkpointFile: string = DEFAULT_CHECKPOINT_FILE) {
    this.sessionId = sessionId;
    this.checkpointFile = checkpointFile;
  }

  /**
   * List all checkpoints for this session
   */
  list(): Checkpoint[] {
    const checkpoints = getSessionCheckpoints(this.sessionId, this.checkpointFile);

    if (checkpoints.length === 0) {
      console.log('⚠️  No checkpoints found for this session');
      return [];
    }

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('📍 CHECKPOINTS');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const byDay = new Map<number, Checkpoint[]>();
    for (const cp of checkpoints) {
      if (!byDay.has(cp.dayNumber)) {
        byDay.set(cp.dayNumber, []);
      }
      byDay.get(cp.dayNumber)!.push(cp);
    }

    for (const [day, cps] of Array.from(byDay.entries()).sort((a, b) => a[0] - b[0])) {
      console.log(`📅 Day ${day}:`);
      for (const cp of cps) {
        const stepDisplay = typeof cp.step === 'number' ? REVERSE_STEP_MAP[cp.step] || `step${cp.step}` : cp.step;
        console.log(`  ${stepDisplay}: ${cp.stepName}`);
        console.log(`     ${new Date(cp.timestamp).toLocaleString()}`);
        console.log();
      }
    }

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`Session: ${this.sessionId}`);
    console.log('═══════════════════════════════════════════════════════════════════\n');

    return checkpoints;
  }

  /**
   * Query agent at a specific checkpoint
   */
  async query(
    dayNumber: number,
    step: string,
    question: string,
    fullContext: boolean = false
  ): Promise<string> {
    const checkpoint = getCheckpoint(this.sessionId, dayNumber, step, this.checkpointFile);

    if (!checkpoint) {
      throw new Error(`No checkpoint found for Day ${dayNumber}, ${step}`);
    }

    const mode = fullContext ? 'Full Context' : 'Point-in-Time';
    console.log(`\n🔍 Querying: Day ${dayNumber}, ${step}`);
    console.log(`📋 Mode: ${mode}`);
    console.log(`📝 Question: "${question}"\n`);

    try {
      const options: any = {
        model: 'claude-sonnet-4-5-20250929',
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code'
        },
        settingSources: ['project'],
        resume: this.sessionId,
        pathToClaudeCodeExecutable: '/Users/pete/.claude/local/claude'
      };

      if (!fullContext) {
        options.resumeSessionAt = checkpoint.messageId;
      }

      const response = query({
        prompt: question,
        options
      });

      let answer = '';

      for await (const message of response) {
        if (message.type === 'assistant') {
          const content = Array.isArray(message.message?.content) ? message.message.content : [];
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

      return answer.trim();
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      throw error;
    }
  }

  /**
   * Get auto-summary of a checkpoint
   */
  async info(dayNumber: number, step: string): Promise<string> {
    const question = "Summarize what you just generated in this step in 2-3 sentences.";
    return this.query(dayNumber, step, question);
  }

  /**
   * Query all checkpoints with the same question
   */
  async queryAll(question: string): Promise<Map<string, string>> {
    const checkpoints = getSessionCheckpoints(this.sessionId, this.checkpointFile);
    const results = new Map<string, string>();

    console.log(`\n🔄 Querying all ${checkpoints.length} checkpoints...\n`);

    for (const cp of checkpoints) {
      const key = `day${cp.dayNumber}_${cp.step}`;

      try {
        const response = await this.query(cp.dayNumber, cp.step, question);
        results.set(key, response);
      } catch (error) {
        console.error(`⚠️  Failed to query ${key}`);
        results.set(key, 'ERROR');
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('📊 ALL RESULTS');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    for (const [key, response] of results.entries()) {
      console.log(`${key}:`);
      console.log(response);
      console.log('\n---\n');
    }

    return results;
  }
}

// ============================================================================
// CLI
// ============================================================================

function printHelp() {
  console.log(`
rewind - Time machine for Claude Code sessions

Usage:
  rewind                                    # List checkpoints
  rewind day2 memory                        # Get summary of checkpoint
  rewind day2 memory "what did you learn?"  # Query at checkpoint
  rewind day2 memory "why?" --full          # Query with full context
  rewind all "how did you evolve?"          # Query all checkpoints

Options:
  -s, --session <id>    Explicit session ID (default: most recent)
  --full                Load full context (see future messages)
  -h, --help            Show this help

Examples:
  rewind
  rewind day1 composition
  rewind day2 memory "what did you remember?"
  rewind day3 planning "what changed?" --full
  rewind all "show me the composition"

Session Inference:
  Looks for .agent-checkpoints.json in current directory.
  Uses most recent session automatically.
`);
}

async function main() {
  // Bun compiled binaries have different argv structure
  // When compiled via bun build --compile:
  //   process.argv = ['bun', '/$bunfs/root/rewind', ...args]
  // When running script with bun:
  //   process.argv = ['bun', '/path/to/file.ts', ...args]

  // Find where actual arguments start
  let argStartIndex = 2; // Works for both compiled binary and script

  if (!process.argv[1]?.endsWith('.ts') && !process.argv[1]?.includes('/$bunfs/root/')) {
    // Direct execution (unlikely but handle it)
    argStartIndex = 1;
  }

  const actualArgs = process.argv.slice(argStartIndex);

  // Help
  if (actualArgs.includes('-h') || actualArgs.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  // Parse session flag
  let sessionId: string | null = null;
  let filteredArgs = actualArgs;

  const sessionFlagIndex = actualArgs.findIndex(arg => arg === '-s' || arg === '--session');
  if (sessionFlagIndex !== -1 && actualArgs[sessionFlagIndex + 1]) {
    sessionId = actualArgs[sessionFlagIndex + 1];
    filteredArgs = actualArgs.filter((_, i) => i !== sessionFlagIndex && i !== sessionFlagIndex + 1);
  }

  // Infer session if not provided
  if (!sessionId) {
    const checkpointPath = resolve(DEFAULT_CHECKPOINT_FILE);
    sessionId = getMostRecentSession(checkpointPath);
    if (!sessionId) {
      console.error('❌ No checkpoints found. Run from a directory with .agent-checkpoints.json');
      console.error(`   Looked for: ${checkpointPath}`);
      process.exit(1);
    }
  }

  const rewind = new Rewind(sessionId);

  // Parse full context flag
  const fullContext = filteredArgs.includes('--full');
  filteredArgs = filteredArgs.filter(arg => arg !== '--full');

  try {
    // No args → list
    if (filteredArgs.length === 0) {
      rewind.list();
      return;
    }

    // "list" → list
    if (filteredArgs[0] === 'list') {
      rewind.list();
      return;
    }

    // "all <question>" → query all
    if (filteredArgs[0] === 'all') {
      const question = filteredArgs.slice(1).join(' ');
      if (!question) {
        console.error('Usage: rewind all "question"');
        process.exit(1);
      }
      await rewind.queryAll(question);
      return;
    }

    // Parse day number (e.g., "day2" → 2)
    const dayArg = filteredArgs[0];
    if (!dayArg.startsWith('day')) {
      console.error('Invalid format. Use: rewind day<N> <step> [question]');
      console.error('Example: rewind day2 memory "what did you learn?"');
      process.exit(1);
    }

    const dayNumber = parseInt(dayArg.replace('day', ''));
    if (isNaN(dayNumber)) {
      console.error('Invalid day number. Use: day1, day2, day3, etc.');
      process.exit(1);
    }

    // Get step name
    const step = filteredArgs[1];
    if (!step) {
      console.error('Missing step name. Use: rewind day2 memory');
      process.exit(1);
    }

    // Get question (rest of args)
    const questionParts = filteredArgs.slice(2);

    if (questionParts.length === 0) {
      // No question → info (auto-summary)
      await rewind.info(dayNumber, step);
    } else {
      // Has question → query
      const question = questionParts.join(' ');
      await rewind.query(dayNumber, step, question, fullContext);
    }

  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default Rewind;
