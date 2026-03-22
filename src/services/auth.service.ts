import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { AuditRepository } from '../repositories/audit.repository';
import { env } from '../lib/env';
import { ConflictError, UnauthorizedError } from '../lib/errors';
import { User } from '../db/schema';

export interface RegisterInput {
  readonly username: string;
  readonly passwordPlain: string;
  readonly role?: string;
}

export interface AuthMeta {
  readonly ip: string | undefined;
  readonly userAgent: string | undefined;
}

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly auditRepo: AuditRepository
  ) {}

  async register(input: Readonly<RegisterInput>, meta: Readonly<AuthMeta>): Promise<{ user: Partial<User> }> {
    const exists = await this.userRepo.existsByUsername(input.username);
    if (exists) {
      throw new ConflictError('Username already exists');
    }

    const hash = await bcrypt.hash(input.passwordPlain, env.BCRYPT_ROUNDS);
    
    const user = await this.userRepo.create({
      username: input.username,
      passwordHash: hash,
      ...(input.role && { role: input.role }),
    });

    await this.auditRepo.log({
      userId: user.id || null,
      action: 'auth.register',
      success: true,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return { user };
  }

  async login(username: string, passwordPlain: string, meta: Readonly<AuthMeta>): Promise<{ user: Partial<User>, token: string }> {
    const user = await this.userRepo.findByUsername(username);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account disabled');
    }

    await this.sessionRepo.deactivateAllForUser(user.id);

    const isValid = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isValid) {
      await this.auditRepo.log({
        userId: user.id,
        action: 'auth.login_failed',
        success: false,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedError('Invalid credentials');
    }

    const signOptions: jwt.SignOptions = { 
      algorithm: 'HS256',
      jwtid: crypto.randomUUID()
    };
    if (env.JWT_EXPIRES_IN) {
      signOptions.expiresIn = env.JWT_EXPIRES_IN as never;
    }

    const token = jwt.sign(
      { sub: user.id, role: user.role },
      env.JWT_SECRET,
      signOptions
    );

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const decoded = jwt.decode(token) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);

    await this.sessionRepo.create({
      userId: user.id,
      tokenHash,
      expiresAt,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    await this.userRepo.updateLastLogin(user.id);

    await this.auditRepo.log({
      userId: user.id,
      action: 'auth.login',
      success: true,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    const { passwordHash, ...userWithoutHash } = user;
    return { user: userWithoutHash, token };
  }

  async logout(tokenHash: string, userId: string, meta: Readonly<AuthMeta>): Promise<void> {
    const session = await this.sessionRepo.findActiveByTokenHash(tokenHash);
    if (session) {
      await this.sessionRepo.deactivateById(session.id);
    }
    
    await this.auditRepo.log({
      userId,
      action: 'auth.logout',
      success: true,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async validateToken(token: string): Promise<{ userId: string; role: string }> {
    try {
      jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw new UnauthorizedError('Invalid token');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = await this.sessionRepo.findActiveByTokenHash(tokenHash);
    
    if (!session) {
      throw new UnauthorizedError('Invalid session');
    }

    const decoded = jwt.decode(token) as { sub: string, role: string };
    return { userId: decoded.sub, role: decoded.role };
  }
}
