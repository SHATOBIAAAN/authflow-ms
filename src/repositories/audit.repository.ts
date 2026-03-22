import { eq, and, gt, sql } from 'drizzle-orm';
import { DrizzleDB } from '../db';
import { auditLog, NewAuditLog } from '../db/schema';
import { logger } from '../lib/logger';

export class AuditRepository {
  constructor(private readonly db: DrizzleDB) {}

  async log(input: NewAuditLog): Promise<void> {
    setImmediate(() => {
      this.db
        .insert(auditLog)
        .values(input)
        .execute()
        .catch((err) => {
          logger.error({ err, action: input.action }, 'Failed to fire-and-forget audit log');
        });
    });
  }

  async findFailedAttempts(userId: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.userId, userId),
          eq(auditLog.success, false),
          gt(auditLog.createdAt, since)
        )
      );

    return Number(row?.count ?? 0);
  }
}
