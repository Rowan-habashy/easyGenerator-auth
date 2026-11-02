import { Request } from 'express';

export interface AuthContext {
  userId: string;
  sessionId: string;
}

export type AppRequest = Request & { id?: string; auth?: AuthContext };
