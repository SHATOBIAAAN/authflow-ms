import { eq, and, gt, sql } from 'drizzle-orm';
import { DrizzleDB } from '../db';
import { sessions, NewSession, Session } from '../db/schema';

export class SessionRepository {
  constructor(private readonly db: DrizzleDB) {}

  async create(input: NewSession): Promise<Session> {
    const [session] = await this.db
      .insert(sessions)
      .values(input)
      .returning({
        id: sessions.id,
        userId: sessions.userId,
        tokenHash: sessions.tokenHash,
        expiresAt: sessions.expiresAt,
        isActive: sessions.isActive,
        ipAddress: sessions.ipAddress,
        userAgent: sessions.userAgent,
        createdAt: sessions.createdAt,
      });
    
    return session!;
  }

  async findActiveByTokenHash(tokenHash: string): Promise<Session | null> {
    const [session] = await this.db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        tokenHash: sessions.tokenHash,
        expiresAt: sessions.expiresAt,
        isActive: sessions.isActive,
        ipAddress: sessions.ipAddress,
        userAgent: sessions.userAgent,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          eq(sessions.isActive, true),
          gt(sessions.expiresAt, sql`now()`)
        )
      )
      .limit(1);

    return session ?? null;
  }

  async deactivateAllForUser(userId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ isActive: false })
      .where(eq(sessions.userId, userId));
  }

  async deactivateById(id: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ isActive: false })
      .where(eq(sessions.id, id));
  }
}
