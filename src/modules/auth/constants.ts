/** HttpOnly cookie carrying the opaque session token. */
export const SESSION_COOKIE = 'folded_session';

/** Readable cookie carrying the CSRF token (double-submit pattern). */
export const CSRF_COOKIE = 'folded_csrf';

/** Request header the client echoes the CSRF token in. */
export const CSRF_HEADER = 'x-csrf-token';
