type RateLimitBucket = {
  count: number;
  windowStartedAt: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
};

type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const buckets = new Map<string, RateLimitBucket>();
let lastCleanupAt = 0;

function cleanupExpiredBuckets(now: number, windowMs: number) {
  if (now - lastCleanupAt < windowMs) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartedAt >= windowMs) {
      buckets.delete(key);
    }
  }

  lastCleanupAt = now;
}

export function checkRateLimit({
  key,
  limit,
  windowMs,
  now = Date.now(),
}: RateLimitOptions): RateLimitDecision {
  cleanupExpiredBuckets(now, windowMs);

  const existingBucket = buckets.get(key);
  const bucket =
    existingBucket && now - existingBucket.windowStartedAt < windowMs
      ? existingBucket
      : { count: 0, windowStartedAt: now };

  bucket.count += 1;
  buckets.set(key, bucket);

  const resetAt = bucket.windowStartedAt + windowMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
  const remaining = Math.max(0, limit - bucket.count);

  return {
    allowed: bucket.count <= limit,
    remaining,
    resetAt,
    retryAfterSeconds,
  };
}

export function resetRateLimitBucketsForTests() {
  buckets.clear();
  lastCleanupAt = 0;
}
