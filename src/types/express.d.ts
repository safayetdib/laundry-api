import 'express';

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
    }
  }
}

export {};
