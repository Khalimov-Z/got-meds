import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

const PUBLIC_API_RATE_LIMIT = {
  limit: 30,
  windowMs: 60_000,
};

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();

  return (
    forwardedIp ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

export function applyPublicApiRateLimit(request: NextRequest, scope: string) {
  const decision = checkRateLimit({
    key: `${scope}:${getClientIp(request)}`,
    limit: PUBLIC_API_RATE_LIMIT.limit,
    windowMs: PUBLIC_API_RATE_LIMIT.windowMs,
  });

  if (decision.allowed) {
    return null;
  }

  return NextResponse.json(
    {
      success: false,
      error: "Слишком много запросов. Попробуйте позже.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(decision.retryAfterSeconds),
        "X-RateLimit-Limit": String(PUBLIC_API_RATE_LIMIT.limit),
        "X-RateLimit-Remaining": String(decision.remaining),
        "X-RateLimit-Reset": String(Math.ceil(decision.resetAt / 1000)),
      },
    }
  );
}
