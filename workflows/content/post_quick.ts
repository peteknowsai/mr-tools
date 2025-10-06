#!/usr/bin/env bun
/**
 * post_quick - Quick social media post
 *
 * Workflow tool: Agents can post to Twitter/social without
 * needing to know Typefully's full API.
 *
 * Usage:
 *   post_quick "Your tweet text here"
 *   post_quick --schedule tomorrow "Tweet text"
 *   post_quick --thread tweet1.txt tweet2.txt
 *
 * Implementation: Wraps typefully CLI for common patterns
 */

// TODO: Implement
// 1. Take tweet text as argument
// 2. Call: typefully create "<text>" --json
// 3. Return post URL/confirmation

const text = process.argv.slice(2).join(' ');
console.log("STUB: post_quick not yet implemented");
console.log(`Would post: "${text || "<text>"}"`);
process.exit(0);
