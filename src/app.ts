import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { env } from './lib/env';
import { logger } from './lib/logger';
import { queryClient } from './db';
import { registerErrorHandler } from './middleware/error-handler';
import { authRoutes } from './routes/auth.routes';
import { adminRoutes } from './routes/admin.routes';
import { passwordResetRoutes } from './routes/password-reset.routes';

async function buildApp() {
  const fastify = Fastify({
    logger: true,
    trustProxy: true,
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  registerErrorHandler(fastify as any);

  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(adminRoutes, { prefix: '/admin' });
  await fastify.register(passwordResetRoutes, { prefix: '/password-reset' });

  fastify.get('/health', async (request, reply) => {
    try {
      await queryClient`SELECT 1`;
      return reply.status(200).send({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      request.log.error({ err }, 'Healthcheck DB connection failed');
      return reply.status(503).send({
        status: 'error',
        message: 'Database unavailable',
      });
    }
  });

  const signals = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      fastify.log.info(`Received ${signal}, shutting down...`);
      await fastify.close();
      await queryClient.end();
      process.exit(0);
    });
  }

  return fastify;
}

async function start() {
  try {
    const app = await buildApp();
    const address = await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info({ port: env.PORT, env: env.NODE_ENV }, `Server is running at ${address}`);
  } catch (err) {
    logger.error({ err }, 'Failed to start application');
    process.exit(1);
  }
}

start();
