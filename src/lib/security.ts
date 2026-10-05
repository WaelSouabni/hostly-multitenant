import { db } from "@/lib/prisma";

export async function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const bucket = await db.rateLimitBucket.findUnique({ where: { key } });
  if (!bucket || bucket.resetAt <= now) {
    await db.rateLimitBucket.upsert({ where: { key }, create: { key, count: 1, resetAt }, update: { count: 1, resetAt } });
    return { allowed: true, remaining: Math.max(0, limit - 1) };
  }
  if (bucket.count >= limit) return { allowed: false, remaining: 0 };
  const updated = await db.rateLimitBucket.update({ where: { key }, data: { count: { increment: 1 } } });
  return { allowed: updated.count <= limit, remaining: Math.max(0, limit - updated.count) };
}

export async function recordSecurityEvent(input: {
  type: string; userId?: string | null; tenantId?: string | null; ipAddress?: string | null; userAgent?: string | null; metadata?: unknown;
}) {
  await db.securityEvent.create({ data: {
    type: input.type, userId: input.userId ?? undefined, tenantId: input.tenantId ?? undefined,
    ipAddress: input.ipAddress ?? undefined, userAgent: input.userAgent ?? undefined,
    metadata: input.metadata === undefined ? undefined : JSON.stringify(input.metadata),
  }});
}