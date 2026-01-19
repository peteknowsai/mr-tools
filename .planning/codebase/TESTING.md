# Testing Patterns

**Analysis Date:** 2025-01-19

## Test Framework

**Runner:**
- No formal test framework configured
- No Jest, Vitest, or Bun test configuration files detected
- Bun test capabilities available via `bun-types` but not utilized

**Assertion Library:**
- Not applicable (no test framework in use)

**Run Commands:**
```bash
# No test commands configured
# package.json has no test script

# Manual testing approach - run tools directly:
bun run tools/grok/grok.ts --help
bun run tools/gmail/gmail.ts list -n 5
```

## Test File Organization

**Location:**
- No test files exist in the codebase
- No `__tests__`, `tests`, or `*.test.ts` files in source directories
- Only test-related files are type definitions from dependencies (`bun-types/test.d.ts`)

**Naming:**
- Not applicable

**Structure:**
- Not applicable

## Current Testing Approach

**Manual CLI Testing:**
- Tools are tested by direct execution
- Help flag verification: `tool --help`
- Config subcommand: `tool config show`
- Actual API calls for integration testing

**Validation Through Usage:**
- Tools are compiled to binaries and installed globally
- Real-world usage serves as integration testing
- Errors surface during actual operation

## Mocking

**Framework:** Not used

**Patterns:** Not established

**What Should Be Mocked (recommendations):**
- External API calls (OpenAI, Slack, Google, Cloudflare)
- File system operations for credentials
- OAuth flows

**What NOT to Mock (recommendations):**
- CLI argument parsing logic
- Internal data transformations
- Configuration file reading/writing (test with temp files instead)

## Fixtures and Factories

**Test Data:**
- Not established

**Location:**
- Not applicable

**Recommendation for future fixtures:**
```
tests/
├── fixtures/
│   ├── mock-responses/      # API response JSON files
│   ├── sample-configs/      # Sample config files
│   └── checkpoints/         # Sample checkpoint files
└── factories/
    └── createCheckpoint.ts  # Factory functions
```

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
# Not configured - would require test framework setup
```

## Test Types

**Unit Tests:**
- Not implemented
- Candidates for unit testing:
  - `lib/config.ts` - secret management functions
  - `lib/checkpoint.ts` - checkpoint CRUD operations
  - `tools/gpt-image-gen/src/converter.ts` - image conversion utilities
  - `tools/gpt-image-gen/src/api.ts` - parameter validation logic

**Integration Tests:**
- Not implemented
- Currently done manually through CLI execution
- Candidates for integration testing:
  - OAuth flows (gmail, gcal)
  - API request/response cycles
  - Full CLI command execution

**E2E Tests:**
- Not used
- Would require test accounts for external services

## Common Patterns (Recommendations)

**Async Testing:**
```typescript
// Recommended pattern for async CLI operations
import { describe, test, expect } from "bun:test";

describe("grok cli", () => {
  test("parses args correctly", () => {
    const args = parseArgs(["x-topic", "AI news", "--json"]);
    expect(args.command).toBe("x-topic");
    expect(args.args).toEqual(["AI", "news"]);
    expect(args.json).toBe(true);
  });
});
```

**Error Testing:**
```typescript
// Recommended pattern for error cases
test("throws on missing API key", async () => {
  // Temporarily clear env
  const original = process.env.GROK_API_KEY;
  delete process.env.GROK_API_KEY;

  await expect(xTopic("test", false)).rejects.toThrow("Missing Grok API key");

  process.env.GROK_API_KEY = original;
});
```

## Validation Patterns in Code

**Input Validation (current approach):**
- Zod schemas for structured input validation
- Example from `tools/select-card/select-card.ts`:
  ```typescript
  const SelectionSchema = z.object({
    card_id: z.string().min(1, "Card ID is required"),
    rationale: z.string().min(1, "Rationale is required"),
  });

  const result = SelectionSchema.safeParse({ card_id, rationale });
  if (!result.success) {
    throw new Error(`Validation failed:\n${errors}`);
  }
  ```

**API Response Validation:**
- Manual checks on response structure
- Example from `tools/gpt-image-gen/src/api.ts`:
  ```typescript
  private validateParams(params: GenerateImageParams): void {
    if (!params.prompt || params.prompt.trim().length === 0) {
      throw new Error("Prompt cannot be empty");
    }
    if (params.prompt.length > 4000) {
      throw new Error("Prompt exceeds maximum length of 4000 characters");
    }
  }
  ```

## Recommended Test Setup

**To add testing to this project:**

1. **Create test configuration:**
   ```bash
   # bunfig.toml
   [test]
   coverage = true
   coverageReporter = ["text", "lcov"]
   ```

2. **Add test script to package.json:**
   ```json
   {
     "scripts": {
       "test": "bun test",
       "test:watch": "bun test --watch",
       "test:coverage": "bun test --coverage"
     }
   }
   ```

3. **Create test directory structure:**
   ```
   tests/
   ├── lib/
   │   ├── config.test.ts
   │   └── checkpoint.test.ts
   ├── tools/
   │   ├── grok.test.ts
   │   └── gmail.test.ts
   └── fixtures/
       └── mock-secrets.json
   ```

4. **Write initial tests for core library:**
   ```typescript
   // tests/lib/config.test.ts
   import { describe, test, expect, beforeEach, afterEach } from "bun:test";
   import { getSecret, setSecret, readSecrets } from "../../lib/config";

   describe("config", () => {
     test("getSecret returns env var when set", () => {
       process.env.TEST_KEY = "test-value";
       const result = getSecret({
         tool: "test",
         key: "key",
         env: ["TEST_KEY"]
       });
       expect(result).toBe("test-value");
       delete process.env.TEST_KEY;
     });
   });
   ```

## Testing Priority

**High priority (core library):**
1. `lib/config.ts` - Central to all tools
2. `lib/checkpoint.ts` - Complex state management

**Medium priority (utility functions):**
1. `tools/gpt-image-gen/src/converter.ts` - Pure functions
2. `tools/gpt-image-gen/src/api.ts` - Validation logic
3. CLI argument parsing in each tool

**Low priority (integration):**
1. Full CLI tool execution
2. OAuth flows
3. External API interactions

---

*Testing analysis: 2025-01-19*
