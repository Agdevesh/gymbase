import { db } from "@/lib/db";

// Append-only trail of who did what. Never throws: an audit failure must not block the action itself.
export async function audit(gymId: string, userId: string | null, action: string, entity: string, entityId: string | null, summary: string) {
  try {
    await db.auditLog.create({ data: { gymId, userId, action, entity, entityId, summary: summary.slice(0, 500) } });
  } catch (e) {
    console.error("audit failed", action, e);
  }
}
