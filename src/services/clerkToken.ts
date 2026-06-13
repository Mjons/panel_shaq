// Module-level holder for Clerk's getToken(), mirroring Panel Haus's
// Comic-Pro2/src/lib/clerkToken.js. apiPost() in geminiService.ts is a plain
// async function (not a React component), so it can't call the useAuth() hook to
// mint a session token. <ClerkTokenBridge/> registers Clerk's getToken here on
// mount; apiPost calls getClerkToken() to mint a FRESH short-lived token per
// request (Clerk tokens expire ~60s, so we never cache them).
//
// Returns null when no Clerk session is active (or Clerk isn't configured at all)
// — callers then fall back to their existing behaviour (anon / BYOK).

let _getToken: (() => Promise<string | null>) | null = null;

export function registerClerkTokenGetter(fn: () => Promise<string | null>): void {
  _getToken = fn;
}

export function clearClerkTokenGetter(): void {
  _getToken = null;
}

export async function getClerkToken(): Promise<string | null> {
  if (!_getToken) return null;
  try {
    return await _getToken();
  } catch {
    return null;
  }
}
