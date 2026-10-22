import 'express';
import type { Role, UserStatus } from '../modules/users/user.types';

declare global {
  namespace Express {
    interface Request {
      /** Correlation id for this request (echoed in responses and logs). */
      id: string;
      /** Zod-validated request parts populated by the validate() middleware. */
      validated: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
      /** Authenticated principal, set by the authenticate() middleware. */
      user?: {
        id: string;
        name: string;
        phone: string;
        roles: Role[];
        status: UserStatus;
        partnerId?: string;
      };
    }
  }
}

export {};
