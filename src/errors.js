// -----------------------------------------------------------------------------
// Errors.
//
// SourceError: a data source failed; its message is safe to log (no key, no
// URL). ActionFailure: a manifest action failed; Gladys shows what an action
// handler throws in red and what it returns in green, so every failure throws
// one, with the four-language message as `message`.
// -----------------------------------------------------------------------------

export class SourceError extends Error {
  /**
   * @param {string} message
   * @param {{ auth?: boolean, rateLimited?: boolean }} [details]
   */
  constructor(message, { auth = false, rateLimited = false } = {}) {
    super(message);
    this.name = 'SourceError';
    this.auth = auth;
    this.rateLimited = rateLimited;
  }
}

export class ActionFailure extends Error {
  /** @param {{ en: string, fr: string, de: string, es: string }} text */
  constructor(text) {
    super(text.en);
    this.message = text;
  }
}

/** A short reason for a failed fetch: the network code, never the URL. */
export function networkReason(err) {
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
    return 'timeout';
  }
  return err?.cause?.code ?? err?.code ?? 'network error';
}
