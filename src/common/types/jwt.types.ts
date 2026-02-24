import { Role } from '@db/enums';

export interface AccessTokenPayload {
  sub: number;
  role: Role;
  sid: number;
}

export interface RefreshTokenPayload {
  sub: number;
  sid: number;
}
