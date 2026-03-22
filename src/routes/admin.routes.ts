import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { AuditRepository } from '../repositories/audit.repository';
import { AuthService } from '../services/auth.service';
import { db } from '../db';
import { buildAuthenticate } from '../middleware/authenticate';
import { ForbiddenError } from '../lib/errors';
import { users, auditLog } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

export async function adminRoutes(fastify: FastifyInstance) {
  const userRepo = new UserRepository(db);
  const sessionRepo = new SessionRepository(db);
  const auditRepo = new AuditRepository(db);
  const authService = new AuthService(userRepo, sessionRepo, auditRepo);
  const authenticate = buildAuthenticate(authService);

  fastify.addHook('preHandler', async (request, reply) => {
    await authenticate(request, reply);
    if (request.user.role !== 'admin') {
      throw new ForbiddenError('access admin panel', request.user.role);
    }
  });

  fastify.get('/users', async (request, reply) => {
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      role: users.role,
      isActive: users.isActive,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt,
    }).from(users);

    return reply.status(200).send({ data: { users: allUsers } });
  });

  const auditLogQuerySchema = z.object({
    limit: z.coerce.number().min(1).max(100).default(50),
    userId: z.string().uuid().optional(),
  });

  fastify.get('/audit-log', async (request, reply) => {
    const { limit, userId } = auditLogQuerySchema.parse(request.query);
    
    let query = db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
    if (userId) {
      query = db.select().from(auditLog).where(eq(auditLog.userId, userId)).orderBy(desc(auditLog.createdAt)).limit(limit) as any;
    }

    const logs = await query;
    return reply.status(200).send({ data: { auditLog: logs } });
  });
}
