/**
 * AEGIS-TRACE Auth Utilities
 * Manages the aegis_session cookie which stores the authenticated user's ID.
 * Scoping by user ID ensures localStorage AND Supabase data is isolated per user.
 */

const COOKIE_NAME = 'aegis_session';
const GUEST_PREFIX = 'guest_';

/**
 * Reads the current user ID from the session cookie.
 * Returns null if not logged in.
 */
export function getCurrentUserId(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const value = match.split('=')[1];
  // Reject legacy "authenticated" plain-string cookies from before this fix
  if (!value || value === 'authenticated') return null;
  return decodeURIComponent(value);
}

/**
 * Derives a user-scoped Supabase case ID from the authenticated user's ID.
 * Each user gets their own case partition in the database — no cross-user leakage.
 * Format: CASE-<first 8 chars of userId uppercase>
 * Falls back to a legacy shared ID only if completely unauthenticated.
 */
export function getUserCaseId(): string {
  const userId = getCurrentUserId();
  if (!userId) return 'CASE-2026-00124'; // fallback for unauthenticated
  // Use first 8 chars of userId (UUID) as a short stable unique suffix
  const suffix = userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  return `CASE-${suffix}`;
}

/**
 * Writes the user ID into the session cookie (24h expiry).
 */
export function setSessionCookie(userId: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(userId)}; path=/; max-age=86400; SameSite=Lax`;
}

/**
 * Generates an isolated session for Quick Demo / guest users.
 * Each call to this within the same browser session reuses the stored guest ID,
 * so the demo user doesn't lose state on refresh.
 */
export function getOrCreateGuestId(): string {
  if (typeof localStorage === 'undefined') return `${GUEST_PREFIX}${Date.now()}`;
  const existingGuestId = localStorage.getItem('aegis_guest_id');
  if (existingGuestId) return existingGuestId;
  const newGuestId = `${GUEST_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem('aegis_guest_id', newGuestId);
  return newGuestId;
}

/**
 * Clears the session cookie (logout).
 */
export function clearSessionCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}
