import { Role } from '@db/enums';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  sid: string;
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
}
