import { PublicUser } from '../users/users.service';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export interface LogoutCredentials {
  accessToken?: string;
  refreshToken?: string;
}
