import type { Logger } from '../../lib/logger';

/** Sends an SMS. Implementations must never log the message body (OTP codes). */
export interface SmsSender {
  send(phone: string, message: string): Promise<void>;
}

/**
 * No-op sender used until a real SMS provider is configured. It deliberately
 * does not log the code (security rule: never log OTPs). In development this
 * means there is no delivery; a real provider is a documented integration.
 */
export class StubSmsSender implements SmsSender {
  constructor(private readonly logger?: Logger) {}

  async send(phone: string, _message: string): Promise<void> {
    // Record that a send was attempted, without the body.
    this.logger?.info(
      { phone: `***${phone.slice(-4)}` },
      'OTP SMS send (stub; no provider configured)',
    );
  }
}
