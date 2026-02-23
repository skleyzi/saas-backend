import { Role } from '@db/enums';

export interface AccessTokenPayload {
  sub: number;
  role: Role;
}

export interface RefreshTokenPayload {
  sub: number;
}
