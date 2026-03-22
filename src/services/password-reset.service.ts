import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { DrizzleDB } from '../db';
import { passwordResetTokens, users } from '../db/schema';
import { UnauthorizedError } from '../lib/errors';
import { env } from '../lib/env';

export class PasswordResetService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly db: DrizzleDB
  ) {}

  async requestReset(username: string): Promise<{ message: string, token?: string }> {
    const user = await this.userRepo.findByUsername(username);
    if (!user) {
      return { message: 'If user exists, email sent' };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    return { message: 'If user exists, email sent', token: rawToken };
  }

  async resetPassword(token: string, newPasswordPlain: string): Promise<{ message: string }> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [resetToken] = await this.db
      .select({ id: passwordResetTokens.id, userId: passwordResetTokens.userId })
      .from(passwordResetTokens)
      .where(
        sql`${passwordResetTokens.tokenHash} = ${tokenHash} AND ${passwordResetTokens.usedAt} IS NULL AND ${passwordResetTokens.expiresAt} > now()`
      )
      .limit(1);

    if (!resetToken) {
      throw new UnauthorizedError('Invalid or expired token');
    }

    const newHash = await bcrypt.hash(newPasswordPlain, env.BCRYPT_ROUNDS);

    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash: newHash })
        .where(eq(users.id, resetToken.userId));

      await tx
        .update(passwordResetTokens)
        .set({ usedAt: sql`now()` })
        .where(eq(passwordResetTokens.id, resetToken.id));
    });

    await this.sessionRepo.deactivateAllForUser(resetToken.userId);

    return { message: 'Password updated successfully' };
  }
}
