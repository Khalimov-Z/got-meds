import { beforeEach, describe, expect, it } from "@jest/globals";
import {
  checkRateLimit,
  resetRateLimitBucketsForTests,
} from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimitBucketsForTests();
  });

  it("разрешает запросы в пределах окна лимита", () => {
    const first = checkRateLimit({
      key: "api-search:127.0.0.1",
      limit: 2,
      windowMs: 60_000,
      now: 1_000,
    });
    const second = checkRateLimit({
      key: "api-search:127.0.0.1",
      limit: 2,
      windowMs: 60_000,
      now: 2_000,
    });

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
  });

  it("блокирует запрос после превышения лимита", () => {
    checkRateLimit({
      key: "api-search:127.0.0.1",
      limit: 1,
      windowMs: 60_000,
      now: 1_000,
    });
    const blocked = checkRateLimit({
      key: "api-search:127.0.0.1",
      limit: 1,
      windowMs: 60_000,
      now: 2_000,
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBe(59);
  });

  it("сбрасывает счетчик после окончания окна", () => {
    checkRateLimit({
      key: "api-search:127.0.0.1",
      limit: 1,
      windowMs: 60_000,
      now: 1_000,
    });
    const afterReset = checkRateLimit({
      key: "api-search:127.0.0.1",
      limit: 1,
      windowMs: 60_000,
      now: 61_000,
    });

    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(0);
  });
});
