import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { AuditRepository } from '../repositories/audit.repository';
import { db } from '../db';
import { buildAuthenticate } from '../middleware/authenticate';
import crypto from 'crypto';

const registerSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(128),
  role: z.enum(['user', 'moderator', 'admin']).default('user').optional(),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export async function authRoutes(fastify: FastifyInstance) {
  const userRepo = new UserRepository(db);
  const sessionRepo = new SessionRepository(db);
  const auditRepo = new AuditRepository(db);
  const authService = new AuthService(userRepo, sessionRepo, auditRepo);
  const authenticate = buildAuthenticate(authService);

  fastify.post('/register', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 minute',
      }
    }
  }, async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const meta = { ip: request.ip, userAgent: request.headers['user-agent'] };

    const result = await authService.register({
      username: input.username,
      passwordPlain: input.password,
      ...(input.role && { role: input.role })
    }, meta);

    return reply.status(201).send({ data: result });
  });

  fastify.post('/login', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 minute',
      }
    }
  }, async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const meta = { ip: request.ip, userAgent: request.headers['user-agent'] };

    const result = await authService.login(input.username, input.password, meta);

    return reply.status(200).send({ data: result });
  });

  fastify.post('/logout', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const authHeader = request.headers.authorization!;
    const token = authHeader.split(' ')[1]!;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const meta = { ip: request.ip, userAgent: request.headers['user-agent'] };

    await authService.logout(tokenHash, request.user.userId, meta);

    return reply.status(200).send({ data: { message: 'Logged out successfully' } });
  });

  fastify.get('/me', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const user = await userRepo.findById(request.user.userId);
    return reply.status(200).send({ data: { user } });
  });
}
