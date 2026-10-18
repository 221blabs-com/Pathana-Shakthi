// Sends browser errors to the server log ([CLIENT-ERROR] lines), so a crash
// on a classroom device can be read afterwards. Known harmless noise
// (autoplay blocks, aborted fetches, animation wasm) is ignored; at most
// 10 reports per page load, each message once.
const IGNORE = /ResizeObserver loop|play\(\) (request|failed)|NotAllowedError|AbortError|The user aborted|lottie|wasm|Load failed|Failed to fetch|NetworkError|cancelled|Network request failed/i;
const sent = new Set<string>();
let count = 0;

export function reportClientError(kind: string, error: unknown, extra: Record<string, unknown> = {}) {
  try {
    const err = error as any;
    const message = String(err?.message || err || 'unknown').slice(0, 400);
    if (IGNORE.test(message) || count >= 10 || sent.has(message)) return;
    sent.add(message);
    count++;
    const body = JSON.stringify({
      kind,
      message,
      stack: String(err?.stack || '').slice(0, 1500),
      path: window.location.pathname,
      userAgent: navigator.userAgent.slice(0, 200),
      ...extra,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/client-error', new Blob([body], { type: 'application/json' }));
    } else {
      void fetch('/api/client-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
    }
  } catch {
    // reporting must never throw
  }
}

export function installClientErrorReporting() {
  window.addEventListener('error', (event) => reportClientError('error', event.error || event.message));
  window.addEventListener('unhandledrejection', (event) => reportClientError('unhandledrejection', event.reason));
}
