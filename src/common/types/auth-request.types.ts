import { AccessTokenPayload } from '@common/types/jwt.types';
import { FastifyRequest } from 'fastify';

export interface AuthRequest extends FastifyRequest {
  user?: AccessTokenPayload;
}
