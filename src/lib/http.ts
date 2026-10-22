/** Shapes the standard success response envelope. */
export function successEnvelope<T>(
  data: T,
  requestId: string,
  meta: Record<string, unknown> = {},
): { data: T; meta: Record<string, unknown> } {
  return { data, meta: { requestId, ...meta } };
}

/** Shapes the standard error response envelope. */
export function errorEnvelope(
  code: string,
  message: string,
  requestId: string,
  details: unknown = null,
): { error: { code: string; message: string; details: unknown; requestId: string } } {
  return { error: { code, message, details, requestId } };
}
