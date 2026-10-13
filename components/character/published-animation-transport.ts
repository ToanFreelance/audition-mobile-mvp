/** Transient published-animation transport failures are not content identity changes. */
export class PublishedAnimationTransportError extends Error {
  constructor(resource: string, attempts: number, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Published animation ${resource} unavailable after ${attempts} attempt(s): ${detail}`);
    this.name = "PublishedAnimationTransportError";
  }
}

/**
 * All attempts get a NEW signal and their own deadline, including JSON body
 * consumption. Retrying a GET is safe; immutable release/version validation is
 * performed by the caller after successful delivery.
 */
export async function fetchPublishedAnimationJson(
  fetchResponse: (signal: AbortSignal, attempt: number) => Promise<Response>,
  resource: string,
  timeoutMs: number,
  maxAttempts = 2,
): Promise<unknown> {
  let lastError: unknown = new Error("No request attempted");
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchResponse(controller.signal, attempt);
      if (!response.ok) {
        const failure = new Error(`HTTP ${response.status}`);
        // Retrying a permanently absent or unauthorized immutable release
        // hides a real deployment/configuration failure and wastes the budget.
        if (response.status >= 400 && response.status < 500
          && response.status !== 408 && response.status !== 429) {
          throw new PublishedAnimationTransportError(resource, attempt + 1, failure);
        }
        throw failure;
      }
      return await response.json();
    } catch (error) {
      if (error instanceof PublishedAnimationTransportError) throw error;
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new PublishedAnimationTransportError(resource, maxAttempts, lastError);
}
