import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PasswordResetService } from '../services/password-reset.service';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { db } from '../db';

const requestResetSchema = z.object({
  username: z.string(),
});

const confirmResetSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8).max(128),
});

export async function passwordResetRoutes(fastify: FastifyInstance) {
  const userRepo = new UserRepository(db);
  const sessionRepo = new SessionRepository(db);
  const resetService = new PasswordResetService(userRepo, sessionRepo, db);

  fastify.post('/request', async (request, reply) => {
    const { username } = requestResetSchema.parse(request.body);
    const result = await resetService.requestReset(username);

    // Provide hint in dev mode logs
    request.log.info({ resetGenerated: !!result.token }, 'Password reset flow engaged');

    return reply.status(200).send({ data: { message: 'If user exists, email sent' } });
  });

  fastify.post('/confirm', async (request, reply) => {
    const { token, newPassword } = confirmResetSchema.parse(request.body);
    const result = await resetService.resetPassword(token, newPassword);

    return reply.status(200).send({ data: result });
  });
}
