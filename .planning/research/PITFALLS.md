# Domain Pitfalls: Gemini Video Generation

**Domain:** Async video generation with Gemini/Veo API
**Researched:** 2026-01-19
**Confidence:** MEDIUM (official Gemini docs + community reports, limited production experience data)

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or broken functionality.

### Pitfall 1: Infinite Polling Without Timeout

**What goes wrong:** Polling loops run forever when video generation fails silently or gets stuck at 99% completion.

**Why it happens:**
- No maximum attempt counter
- No absolute timeout (wall clock time)
- Assuming "pending" status will always become "completed" or "failed"
- Video generation can get stuck at 99% and never complete (documented user reports)

**Consequences:**
- Resource exhaustion (memory leaks, hanging processes)
- Cost accumulation (API calls continue indefinitely)
- User never gets feedback
- Server-side processes never terminate

**Prevention:**
```typescript
// BAD: No timeout
while (status === 'pending') {
  await sleep(10000);
  status = await checkStatus(jobId);
}

// GOOD: Maximum attempts + wall clock timeout
const MAX_ATTEMPTS = 60; // 10 minutes at 10s intervals
const MAX_TIME_MS = 15 * 60 * 1000; // 15 minutes absolute
const startTime = Date.now();

for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
  if (Date.now() - startTime > MAX_TIME_MS) {
    throw new TimeoutError('Video generation exceeded 15 minute limit');
  }

  const status = await checkStatus(jobId);
  if (status === 'completed') break;
  if (status === 'failed') throw new GenerationError('Video generation failed');

  await sleep(10000);
}
```

**Detection warning signs:**
- Processes running for >15 minutes
- Memory usage climbing over time
- Hanging jobs in monitoring dashboard

**Which phase:** Phase 1 (Core implementation) - Must have from day 1

---

### Pitfall 2: Cookie Expiration Mid-Generation

**What goes wrong:** Authentication cookies expire during long-running video generation (5-10 minutes), causing retrieval to fail even though generation succeeded.

**Why it happens:**
- Cookie obtained at request start (T=0)
- Video generation takes 5-10 minutes
- Cookie expires at T=5 minutes
- Retrieval attempt at T=10 fails with 401

**Consequences:**
- Lost video (generation succeeded but can't download)
- Wasted quota (counted against daily limits)
- Poor UX (user sees failure after waiting 10 minutes)
- Retry attempt wastes another quota slot

**Prevention:**
```typescript
// BAD: Cookie obtained once at start
const cookies = await getCookies();
const jobId = await startGeneration(prompt, cookies);
await pollUntilComplete(jobId, cookies); // Might be stale
const video = await downloadVideo(jobId, cookies); // Likely fails

// GOOD: Refresh cookies before critical operations
async function downloadVideoWithRetry(jobId: string) {
  let retries = 3;
  while (retries > 0) {
    try {
      // Get fresh cookies immediately before download
      const freshCookies = await getCookies();
      return await downloadVideo(jobId, freshCookies);
    } catch (err) {
      if (err.status === 401 && retries > 1) {
        retries--;
        await sleep(1000); // Brief pause before retry
        continue;
      }
      throw err;
    }
  }
}

// BETTER: Proactive refresh
class CookieManager {
  private cookies: string;
  private lastRefresh: number;
  private REFRESH_INTERVAL = 4 * 60 * 1000; // 4 minutes

  async getCookies(): Promise<string> {
    const now = Date.now();
    if (!this.cookies || (now - this.lastRefresh > this.REFRESH_INTERVAL)) {
      this.cookies = await fetchFreshCookies();
      this.lastRefresh = now;
    }
    return this.cookies;
  }
}
```

**Detection warning signs:**
- 401 errors during download step
- Successful generation + failed retrieval pattern
- Errors correlating with job duration >5 minutes

**Which phase:** Phase 1 (Core implementation) - Critical for reliability

---

### Pitfall 3: Naive Concurrency Limits

**What goes wrong:** Hitting rate limits repeatedly, or underutilizing capacity by being too conservative.

**Why it happens:**
- Gemini API has multiple rate limit dimensions: concurrent requests (2-10), RPM (10-60), RPD (100-1000)
- Different limits for different account tiers (educational vs trial vs paid)
- Limits apply per-project, not per-API-key
- Exceeding ANY dimension triggers 429 errors

**Consequences:**
- Cascade failures (one 429 blocks queue, others timeout)
- Poor throughput (waiting when capacity available)
- Unpredictable behavior across different account types
- Wasted quota on failed attempts

**Prevention:**
```typescript
// BAD: Hardcoded limit without dimension awareness
const CONCURRENT_LIMIT = 2; // Might be too low or too high

// GOOD: Multi-dimensional rate limiting
class RateLimiter {
  private concurrent = 0;
  private requestsThisMinute = 0;
  private requestsToday = 0;

  private limits = {
    concurrent: 5,     // Conservative default
    rpm: 10,           // Requests per minute
    rpd: 100           // Requests per day
  };

  async acquire(): Promise<void> {
    while (
      this.concurrent >= this.limits.concurrent ||
      this.requestsThisMinute >= this.limits.rpm ||
      this.requestsToday >= this.limits.rpd
    ) {
      await sleep(1000);
    }

    this.concurrent++;
    this.requestsThisMinute++;
    this.requestsToday++;
  }

  release() {
    this.concurrent--;
  }

  // Reset counters on interval
  startResetTimers() {
    setInterval(() => this.requestsThisMinute = 0, 60 * 1000);
    setInterval(() => this.requestsToday = 0, 24 * 60 * 60 * 1000);
  }
}

// BETTER: Adaptive limits with 429 detection
class AdaptiveRateLimiter extends RateLimiter {
  async executeWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
    let retries = 5;
    let backoff = 1000;

    while (retries > 0) {
      try {
        await this.acquire();
        const result = await fn();
        this.release();
        return result;
      } catch (err) {
        this.release();

        if (err.status === 429) {
          // Temporarily reduce concurrent limit
          this.limits.concurrent = Math.max(1, this.limits.concurrent - 1);
          await sleep(backoff);
          backoff *= 2; // Exponential backoff
          retries--;
          continue;
        }
        throw err;
      }
    }
    throw new Error('Max retries exceeded');
  }
}
```

**Detection warning signs:**
- Repeated 429 errors in logs
- Jobs queuing up despite low concurrency
- Inconsistent behavior between environments

**Which phase:** Phase 2 (Production hardening) - Can start simple, must improve for scale

---

### Pitfall 4: Placeholder URL Assumption

**What goes wrong:** Assuming the initial response URL is a valid download link, when it's actually a placeholder that requires separate retrieval.

**Why it happens:**
- API returns immediate response with operation ID
- Response may include a URL field that looks valid
- Actual video URL requires polling operation status
- Different from other file APIs that return direct URLs

**Consequences:**
- 404 errors when trying to download
- Confusion about when video is actually ready
- Missing the actual download URL in operation response
- Poor error messages ("video not found" vs "video not ready")

**Prevention:**
```typescript
// BAD: Assuming response URL is valid
const response = await gemini.generateVideo(prompt);
const video = await fetch(response.url); // Likely fails

// GOOD: Poll operation and extract real URL
const operation = await gemini.generateVideo(prompt);
let completedOp = operation;

while (!completedOp.done) {
  await sleep(10000);
  completedOp = await gemini.operations.get(operation.name);
}

// Extract actual video URL from completed operation
const videoUrl = completedOp.response?.videoUrl; // Check actual field name
if (!videoUrl) {
  throw new Error('Video generated but no download URL found');
}

const video = await fetch(videoUrl);
```

**Detection warning signs:**
- 404 errors on video downloads
- Immediate download attempts (before polling)
- Confusion in logs about "video URL"

**Which phase:** Phase 1 (Core implementation) - Must understand response structure

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or poor UX.

### Pitfall 5: Fixed Polling Interval

**What goes wrong:** Using constant 10-second polling interval wastes time early on and hammers API late in generation.

**Why it happens:**
- Official examples show fixed 10s interval
- Easy to implement
- Doesn't account for generation lifecycle (fast start → slow middle → fast end)

**Consequences:**
- Slower perceived response (could detect completion earlier)
- Unnecessary API calls (polling when generation unlikely to be done)
- Poor UX (no progress indication)

**Prevention:**
```typescript
// BAD: Fixed interval
while (!done) {
  await sleep(10000); // Always 10s
  status = await check();
}

// GOOD: Adaptive polling
async function pollWithBackoff(operationName: string) {
  const intervals = [
    2000,  // 2s  - Quick check early
    5000,  // 5s  - Still relatively fast
    10000, // 10s - Standard interval
    15000, // 15s - Slow down for long jobs
    20000, // 20s - Even slower
  ];

  let attempt = 0;
  while (true) {
    const operation = await client.operations.get(operationName);
    if (operation.done) return operation;

    const intervalIndex = Math.min(attempt, intervals.length - 1);
    await sleep(intervals[intervalIndex]);
    attempt++;
  }
}

// BETTER: Exponential backoff with jitter
function calculateNextInterval(attempt: number): number {
  const baseInterval = 2000; // 2s
  const maxInterval = 30000; // 30s
  const exponential = baseInterval * Math.pow(1.5, attempt);
  const capped = Math.min(exponential, maxInterval);
  const jitter = capped * (0.5 + Math.random() * 0.5); // ±25% jitter
  return jitter;
}
```

**Prevention:** Implement adaptive polling intervals based on attempt count

**Which phase:** Phase 2 (Production hardening) - Nice to have for better UX

---

### Pitfall 6: Missing Progress Indicators

**What goes wrong:** Users have no idea if generation is working, stuck, or failed during 5-10 minute wait.

**Why it happens:**
- API doesn't provide progress percentage
- Polling only returns "pending" or "done"
- No intermediate status updates

**Consequences:**
- Users think tool is broken
- Premature cancellations
- Support burden ("Is it working?")
- Poor perceived performance

**Prevention:**
```typescript
// BAD: Silent waiting
await pollUntilComplete(jobId);

// GOOD: Emit progress events
async function pollWithProgress(
  jobId: string,
  onProgress: (elapsed: number, attempt: number) => void
) {
  const startTime = Date.now();
  let attempt = 0;

  while (true) {
    const elapsed = Date.now() - startTime;
    onProgress(elapsed, attempt);

    const status = await checkStatus(jobId);
    if (status === 'completed') break;

    await sleep(10000);
    attempt++;
  }
}

// Usage:
await pollWithProgress(jobId, (elapsed, attempt) => {
  console.log(`[${Math.floor(elapsed/1000)}s] Attempt ${attempt} - still generating...`);
});
```

**Prevention:** Add progress callbacks and time-based updates

**Which phase:** Phase 1 (Core implementation) - Important for CLI UX

---

### Pitfall 7: No Failed State Handling

**What goes wrong:** Generation fails (prompt rejected, server error, quota exceeded) but tool doesn't surface reason clearly.

**Why it happens:**
- API can return various failure modes
- Error details buried in operation metadata
- Different error types need different handling
- Prompt content policy violations not obvious

**Consequences:**
- Users retry same prompt repeatedly (wastes quota)
- No actionable feedback
- Can't distinguish transient vs permanent failures

**Prevention:**
```typescript
// BAD: Generic error
if (operation.error) {
  throw new Error('Generation failed');
}

// GOOD: Detailed error handling
interface GenerationError {
  type: 'quota_exceeded' | 'content_policy' | 'server_error' | 'timeout';
  message: string;
  retryable: boolean;
  suggestedAction?: string;
}

function parseOperationError(operation: any): GenerationError {
  if (operation.error?.code === 429) {
    return {
      type: 'quota_exceeded',
      message: 'Daily video generation quota exceeded',
      retryable: false,
      suggestedAction: 'Wait until quota resets at midnight UTC'
    };
  }

  if (operation.error?.message?.includes('content policy')) {
    return {
      type: 'content_policy',
      message: 'Prompt violates content policy',
      retryable: false,
      suggestedAction: 'Revise prompt to avoid restricted content'
    };
  }

  if (operation.error?.code >= 500) {
    return {
      type: 'server_error',
      message: 'Server error during generation',
      retryable: true,
      suggestedAction: 'Retry during off-peak hours'
    };
  }

  return {
    type: 'timeout',
    message: operation.error?.message || 'Unknown error',
    retryable: true
  };
}
```

**Prevention:** Parse error types and provide actionable guidance

**Which phase:** Phase 1 (Core implementation) - Critical for good UX

---

### Pitfall 8: Synchronous Queue Processing

**What goes wrong:** Processing video generation requests sequentially when concurrency limit allows parallel processing.

**Why it happens:**
- Simple queue.shift() in a loop
- Not leveraging concurrent capacity (2-5 simultaneous)
- Treating queue like single-threaded task list

**Consequences:**
- Throughput limited to 1 request per 5-10 minutes
- Queue backs up unnecessarily
- Poor resource utilization

**Prevention:**
```typescript
// BAD: Sequential processing
async function processQueue(queue: Request[]) {
  for (const request of queue) {
    await generateVideo(request); // One at a time
  }
}

// GOOD: Concurrent processing with limit
async function processQueueConcurrent(queue: Request[], limit: number = 2) {
  const workers = Array.from({ length: limit }, async () => {
    while (queue.length > 0) {
      const request = queue.shift();
      if (!request) break;

      try {
        await generateVideo(request);
      } catch (err) {
        console.error('Generation failed:', err);
        // Optionally re-queue or log failure
      }
    }
  });

  await Promise.all(workers);
}

// BETTER: Use proper queue library (BullMQ, etc)
import { Queue, Worker } from 'bullmq';

const queue = new Queue('video-generation', {
  connection: redisConnection
});

const worker = new Worker('video-generation',
  async (job) => {
    return await generateVideo(job.data);
  },
  {
    connection: redisConnection,
    concurrency: 2 // Concurrent job limit
  }
);
```

**Prevention:** Use concurrent workers or queue library with concurrency control

**Which phase:** Phase 2 (Production hardening) - Can start simple, improve later

---

## Edge Cases

Unusual scenarios to handle gracefully.

### Edge Case 1: Rate Limit Reset Timing

**Scenario:** Requests near midnight UTC may succeed or fail unpredictably due to quota reset timing.

**Impact:** Confusing behavior where quota appears inconsistent.

**Handling:**
```typescript
// Track quota locally to predict failures
class QuotaTracker {
  private requestsToday = 0;
  private dailyLimit = 100;
  private lastReset = new Date().setUTCHours(0, 0, 0, 0);

  canMakeRequest(): boolean {
    this.checkReset();
    return this.requestsToday < this.dailyLimit;
  }

  recordRequest() {
    this.checkReset();
    this.requestsToday++;
  }

  private checkReset() {
    const midnightUTC = new Date().setUTCHours(0, 0, 0, 0);
    if (midnightUTC > this.lastReset) {
      this.requestsToday = 0;
      this.lastReset = midnightUTC;
    }
  }
}
```

**Which phase:** Phase 2 (Production hardening)

---

### Edge Case 2: Partial Network Failures

**Scenario:** Video generates successfully but download is interrupted mid-transfer.

**Impact:** Corrupted video file, wasted quota, no way to retry download.

**Handling:**
```typescript
async function downloadWithChecksum(url: string, expectedSize?: number): Promise<Buffer> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();

  if (expectedSize && buffer.byteLength !== expectedSize) {
    throw new Error(`Download incomplete: got ${buffer.byteLength}, expected ${expectedSize}`);
  }

  // Verify video is valid (basic check)
  const header = Buffer.from(buffer.slice(0, 12));
  if (!header.toString('ascii').includes('ftyp')) { // MP4 signature
    throw new Error('Downloaded file is not a valid video');
  }

  return Buffer.from(buffer);
}
```

**Which phase:** Phase 2 (Production hardening)

---

### Edge Case 3: Server Congestion During Peak Hours

**Scenario:** Requests fail or timeout more frequently during peak usage (afternoon/evening in target regions).

**Impact:** Higher failure rate at specific times, user frustration.

**Handling:**
```typescript
// Detect and warn about peak hours
function isPeakHour(): boolean {
  const hour = new Date().getUTCHours();
  // Assuming peak: 14:00-22:00 UTC (US afternoon/evening)
  return hour >= 14 && hour < 22;
}

async function generateWithPeakWarning(prompt: string) {
  if (isPeakHour()) {
    console.warn('⚠️  Peak usage hours detected. Generation may be slower or fail more often.');
    console.warn('💡 Consider trying during off-peak hours (22:00-14:00 UTC) for better results.');
  }

  return await generateVideo(prompt);
}
```

**Which phase:** Phase 3 (Enhancements) - Nice to have

---

### Edge Case 4: Cookie Format Changes

**Scenario:** Google changes cookie format or authentication mechanism between versions.

**Impact:** Tool breaks completely until updated.

**Handling:**
```typescript
// Version detection and migration
interface CookieConfig {
  version: string;
  format: 'v1' | 'v2';
  fields: string[];
}

function detectCookieFormat(cookies: string): CookieConfig {
  // Check for known patterns
  if (cookies.includes('__Secure-1PSID')) {
    return { version: '2024-12', format: 'v1', fields: ['__Secure-1PSID', 'SAPISID'] };
  }

  // Future format detection
  throw new Error('Unknown cookie format - tool may need update');
}

// Allow manual override for new formats
const cookieFormat = process.env.COOKIE_FORMAT || 'auto';
```

**Which phase:** Phase 3 (Enhancements) - Add when stable

---

## Testing Considerations

What's hard to test and how to verify functionality.

### Challenge 1: Long Test Duration

**Problem:** Each video generation takes 5-10 minutes, making test suites painfully slow.

**Solution:**
- Use mocked responses for unit tests
- One integration test per day (CI/CD)
- Separate "smoke test" command for quick verification
- Record real API responses (VCR pattern) for playback

```typescript
// tests/mocks/gemini-responses.ts
export const MOCK_OPERATIONS = {
  pending: {
    name: 'operations/test-123',
    done: false,
    metadata: { progress: 'pending' }
  },
  completed: {
    name: 'operations/test-123',
    done: true,
    response: { videoUrl: 'https://...' }
  },
  failed: {
    name: 'operations/test-123',
    done: true,
    error: { code: 400, message: 'Content policy violation' }
  }
};
```

**Which phase:** Continuous (all phases need tests)

---

### Challenge 2: Cookie Expiration Testing

**Problem:** Hard to test cookie expiration without waiting hours or manipulating system time.

**Solution:**
- Use short-lived test cookies (if API supports)
- Mock cookie manager with configurable expiry
- Manual testing checklist for long-running scenarios

```typescript
// tests/cookie-manager.test.ts
class MockCookieManager extends CookieManager {
  constructor(private expirySeconds: number = 10) {
    super();
  }

  // Override for faster expiry in tests
  protected getRefreshInterval(): number {
    return this.expirySeconds * 1000;
  }
}

test('refreshes cookies after expiry', async () => {
  const mgr = new MockCookieManager(2); // 2 second expiry
  const initial = await mgr.getCookies();
  await sleep(3000);
  const refreshed = await mgr.getCookies();
  expect(refreshed).not.toBe(initial);
});
```

**Which phase:** Phase 1 (Core implementation)

---

### Challenge 3: Rate Limit Testing

**Problem:** Can't test rate limits without hitting actual quotas (wastes resources).

**Solution:**
- Mock rate limiter with configurable limits
- Test backoff logic independently
- Monitor real usage in production for adjustments

```typescript
// tests/rate-limiter.test.ts
test('respects concurrent limit', async () => {
  const limiter = new RateLimiter({ concurrent: 2, rpm: 100, rpd: 1000 });

  let activeRequests = 0;
  let maxActive = 0;

  const requests = Array.from({ length: 10 }, async () => {
    await limiter.acquire();
    activeRequests++;
    maxActive = Math.max(maxActive, activeRequests);

    await sleep(100); // Simulate work

    activeRequests--;
    limiter.release();
  });

  await Promise.all(requests);
  expect(maxActive).toBeLessThanOrEqual(2);
});
```

**Which phase:** Phase 1 (Core implementation)

---

### Challenge 4: Error Scenario Coverage

**Problem:** Hard to trigger specific API errors (quota exceeded, content policy, server errors).

**Solution:**
- Mock error responses
- Use known-bad prompts for content policy testing
- Document manual test cases for rare errors

```typescript
// tests/fixtures/error-scenarios.ts
export const ERROR_PROMPTS = {
  contentPolicy: 'Generate video of [restricted content]',
  tooComplex: 'Generate 4K video with 100 different objects...',
  malformed: '', // Empty prompt
};

// Manual testing checklist
// □ Quota exceeded (make 101 requests in one day)
// □ Cookie expired (wait 6+ hours mid-generation)
// □ Server congestion (test during peak hours)
```

**Which phase:** Phase 2 (Production hardening)

---

### Challenge 5: Concurrent Queue Behavior

**Problem:** Race conditions and edge cases only appear under concurrent load.

**Solution:**
- Stress tests with high concurrency
- Property-based testing for queue invariants
- Chaos testing (random delays, failures)

```typescript
// tests/queue-stress.test.ts
test('maintains queue order under concurrency', async () => {
  const queue = new VideoQueue({ concurrent: 5 });
  const results: number[] = [];

  // Submit 50 requests
  const requests = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    prompt: `Test ${i}`
  }));

  await Promise.all(
    requests.map(req =>
      queue.enqueue(req).then(() => results.push(req.id))
    )
  );

  // Verify all completed
  expect(results.length).toBe(50);

  // Verify no duplicates
  expect(new Set(results).size).toBe(50);
});
```

**Which phase:** Phase 2 (Production hardening)

---

## Phase Recommendations

Based on pitfall severity and testing needs:

| Phase | Must Address | Should Address | Can Defer |
|-------|--------------|----------------|-----------|
| **Phase 1: Core** | Infinite polling timeout, Cookie expiration, Placeholder URL, Failed state handling, Progress indicators | Fixed polling interval, Missing error details | Adaptive rate limits, Peak hour warnings |
| **Phase 2: Production** | Naive concurrency limits, Synchronous queue | Rate limit edge cases, Download verification | Cookie format versioning |
| **Phase 3: Enhancements** | - | Peak hour detection, Advanced queue features | Third-party integrations |

---

## Research Confidence Notes

**HIGH confidence (official docs):**
- Polling intervals (10s recommended)
- Rate limit dimensions (RPM, RPD, concurrent)
- File size limits and URL handling

**MEDIUM confidence (community reports + docs):**
- Cookie expiration timing (~4-6 hours based on Google session patterns)
- Concurrent limits (2-10 range, varies by tier)
- 99% stuck generation bug (user reports, not official)

**LOW confidence (needs validation):**
- Exact cookie refresh requirements (no official docs found)
- Optimal polling backoff strategy (general best practices, not Gemini-specific)
- Peak hour impact (inferred from general API behavior)

---

## Sources

- [Gemini Video Generation (Veo) | liteLLM](https://docs.litellm.ai/docs/providers/gemini/videos)
- [Generate videos with Veo 3.1 in Gemini API | Google AI for Developers](https://ai.google.dev/gemini-api/docs/video)
- [Gemini API Rate Limits Explained: Complete 2026 Guide](https://www.aifreeapi.com/en/posts/gemini-api-rate-limit-explained)
- [Rate limits | Gemini API | Google AI for Developers](https://ai.google.dev/gemini-api/docs/rate-limits)
- [How to Fix Veo 3.1 'Lot of Requests Right Now' Error](https://www.aifreeapi.com/en/posts/veo-3-1-lot-of-requests-error)
- [Video generation stops at 99% - Gemini Apps Community](https://support.google.com/gemini/thread/394508421)
- [Timeouts, retries and backoff with jitter - AWS](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
- [Backoff and Retry – Polling – Complete Intro to Realtime](https://btholt.github.io/complete-intro-to-realtime/backoff-and-retry/)
- [How to Handle Sessions with Cookies and Tokens | Curity](https://curity.medium.com/how-to-handle-sessions-with-cookies-and-tokens-29fd77eda4c0)
- [Building AI Video Generation Pipelines with AWS Lambda Durable Functions](https://dev.to/aws-builders/building-ai-video-generation-pipelines-with-aws-lambda-durable-functions-4kp0)
- [BullMQ - Background Jobs processing for NodeJS](https://bullmq.io/)
- [Gemini API File Handling Update | Google](https://juliangoldie.com/gemini-api-file-handling-update/)
