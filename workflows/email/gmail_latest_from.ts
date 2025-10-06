#!/usr/bin/env bun
/**
 * gmail_latest_from - Get latest email from specific sender
 *
 * Workflow tool: Quickly retrieve most recent email from a sender
 * without having to construct search queries.
 *
 * Usage:
 *   gmail_latest_from "sender@example.com"
 *   gmail_latest_from "github.com" --json
 *   gmail_latest_from "notifications" --subject "build"
 *
 * Implementation: Wraps gmail search with sender filter
 */

// TODO: Implement
// 1. Take sender as argument
// 2. Call: gmail search from:<sender> -n 1 --json
// 3. Return formatted email summary

const sender = process.argv[2];
console.log(`STUB: gmail_latest_from not yet implemented`);
console.log(`Would fetch latest email from: ${sender || "<sender>"}`);
process.exit(0);
