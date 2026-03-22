import { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from '../lib/errors';
import { AuthService } from '../services/auth.service';

declare module 'fastify' {
  interface FastifyRequest {
    user: { userId: string; role: string };
  }
}

export function buildAuthenticate(authService: AuthService) {
  return async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const payload = await authService.validateToken(token);
    
    request.user = { userId: payload.userId, role: payload.role };
  };
}
