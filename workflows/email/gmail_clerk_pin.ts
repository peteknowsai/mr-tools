#!/usr/bin/env bun
/**
 * gmail_clerk_pin - Get latest Clerk verification PIN
 *
 * Workflow tool for App Team: Quickly retrieve the latest
 * Clerk.com verification code during login testing.
 *
 * Usage:
 *   gmail_clerk_pin              # Returns just the PIN
 *   gmail_clerk_pin --json       # Returns JSON with metadata
 *
 * Email format:
 *   Subject: "[Development] 624351 is your verification code"
 *   Future:  "[Production] 624351 is your verification code"  (when app name changes to captain32)
 */

import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GMAIL_BIN = join(__dirname, "../../bin/gmail");

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");

try {
  // Get last 5 emails (verification code will be recent)
  const listOutput = execSync(`${GMAIL_BIN} list -n 5 --json`, { encoding: "utf-8" });
  const emails = JSON.parse(listOutput);

  // Search for verification code email
  for (const email of emails) {
    const emailData = execSync(`${GMAIL_BIN} read "${email.id}" --json`, { encoding: "utf-8" });
    const fullEmail = JSON.parse(emailData);

    // Find subject header
    const subjectHeader = fullEmail.payload.headers.find((h: any) => h.name === "Subject");
    if (!subjectHeader) continue;

    const subject = subjectHeader.value;

    // Check if this is a verification code email
    if (subject.includes("verification code")) {
      // Extract 6-digit PIN from subject
      // Format: "[Development] 624351 is your verification code"
      const pinMatch = subject.match(/(\d{6})/);

      if (pinMatch) {
        const pin = pinMatch[1];

        if (jsonOutput) {
          console.log(JSON.stringify({
            pin,
            subject,
            messageId: email.id,
            timestamp: new Date().toISOString()
          }, null, 2));
        } else {
          console.log(pin);
        }
        process.exit(0);
      }
    }
  }

  // No verification code found
  if (jsonOutput) {
    console.log(JSON.stringify({
      error: "No verification code found",
      message: "No Clerk verification email found in last 5 messages"
    }, null, 2));
  } else {
    console.error("Error: No verification code found in last 5 emails");
  }
  process.exit(1);

} catch (error) {
  if (jsonOutput) {
    console.log(JSON.stringify({
      error: "Failed to retrieve PIN",
      message: error instanceof Error ? error.message : String(error)
    }, null, 2));
  } else {
    console.error("Error:", error instanceof Error ? error.message : String(error));
  }
  process.exit(1);
}
