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

// --- Soft-gate bridge: lets non-React code (apiPost) check sign-in state and
// open Clerk's sign-in modal without holding a hook. Registered by ClerkTokenBridge.
let _isSignedIn: (() => boolean) | null = null;
let _openSignIn: (() => void) | null = null;

export function registerClerkGate(g: {
  isSignedIn: () => boolean;
  openSignIn: () => void;
}): void {
  _isSignedIn = g.isSignedIn;
  _openSignIn = g.openSignIn;
}

export function clearClerkGate(): void {
  _isSignedIn = null;
  _openSignIn = null;
}

export function isClerkSignedIn(): boolean {
  return _isSignedIn ? _isSignedIn() : false;
}

export function openClerkSignIn(): void {
  if (_openSignIn) _openSignIn();
}

/** True when a Clerk publishable key is configured (build-time). When false the
 * app runs without auth/credits exactly as before. */
export function isClerkEnabled(): boolean {
  return !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
}
