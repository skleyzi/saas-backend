import { User } from '@db/client';
import { FastifyRequest } from 'fastify';

export type RequestUser = Omit<User, 'passwordHash'>;

export interface AuthRequest extends FastifyRequest {
  user?: RequestUser;
}
