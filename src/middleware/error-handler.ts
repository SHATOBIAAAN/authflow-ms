import { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';

export function registerErrorHandler(fastify: FastifyInstance): void {
  fastify.setErrorHandler((error: FastifyError | AppError | Error, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof AppError) {
      request.log.warn({ err: error, code: error.code, context: error.context }, error.message);
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', issues: error.issues },
      });
    }

    if ('statusCode' in error && (error as any).statusCode === 429) {
      request.log.warn({ ip: request.ip, url: request.url }, 'Rate limit exceeded');
      return reply.status(429).send({
        error: { code: 'RATE_LIMITED', message: 'Too many requests, try again later' },
      });
    }

    request.log.error({ err: error }, 'Unexpected error');
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });
}
