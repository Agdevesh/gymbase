import { db } from "@/lib/db";

// Fixed window counter in Postgres so limits hold across serverless instances. Returns true when allowed.
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = new Date();
  const row = await db.rateLimit.findUnique({ where: { key } });
  if (!row || row.resetAt <= now) {
    await db.rateLimit.upsert({ where: { key }, create: { key, count: 1, resetAt: new Date(now.getTime() + windowMs) }, update: { count: 1, resetAt: new Date(now.getTime() + windowMs) } });
    return true;
  }
  if (row.count >= limit) return false;
  await db.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  return true;
}

export const clearRateLimit = (key: string) => db.rateLimit.deleteMany({ where: { key } }).catch(() => undefined);
