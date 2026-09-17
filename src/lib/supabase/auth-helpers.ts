/**
 * AEGIS-TRACE Auth Helpers
 *
 * Wraps Supabase auth calls with:
 *  1. Email rate-limit detection & friendly error messages
 *  2. Client-side signup cooldown (prevents hammering the 3 emails/hr quota)
 *  3. Auto sign-in after registration (works when Supabase "Confirm Email" is OFF)
 */

import { SupabaseClient } from "@supabase/supabase-js";

// --- Constants ----------------------------------------------------------------

/** Supabase error codes / message fragments that indicate email rate limiting */
const RATE_LIMIT_SIGNALS = [
  "over_email_send_rate_limit",
  "email rate limit",
  "too many requests",
  "rate limit exceeded",
  "429",
];

/** Client-side cooldown between email-sending operations (60 seconds) */
const EMAIL_COOLDOWN_MS = 60_000;

const LS_LAST_EMAIL_KEY = "aegis_last_email_sent";
const LS_LAST_SIGNUP_KEY = "aegis_last_signup_attempt";

// --- Types --------------------------------------------------------------------

export interface SafeSignUpResult {
  userId: string | null;
  sessionReady: boolean; // true if user is immediately logged in (confirm email = OFF)
  needsEmailConfirmation: boolean; // true if Supabase requires email click
  rateLimited: boolean;
  error: string | null;
}

// --- Rate limit detection -----------------------------------------------------

/**
 * Returns true if the given error object or message signals an email rate limit.
 */
export function isEmailRateLimitError(err: unknown): boolean {
  if (!err) return false;
  const msg =
    typeof err === "string"
      ? err
      : (err as any)?.message ||
        (err as any)?.error_description ||
        JSON.stringify(err);
  const lower = String(msg).toLowerCase();
  return RATE_LIMIT_SIGNALS.some((signal) =>
    lower.includes(signal.toLowerCase())
  );
}

// --- Client-side cooldown helpers --------------------------------------------

function getTimestamp(key: string): number {
  if (typeof localStorage === "undefined") return 0;
  return parseInt(localStorage.getItem(key) || "0", 10);
}

function setTimestamp(key: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, String(Date.now()));
}

/**
 * Returns remaining cooldown in milliseconds (0 = no cooldown active).
 */
export function getEmailCooldownRemaining(): number {
  const last = Math.max(
    getTimestamp(LS_LAST_EMAIL_KEY),
    getTimestamp(LS_LAST_SIGNUP_KEY)
  );
  if (!last) return 0;
  const elapsed = Date.now() - last;
  return Math.max(0, EMAIL_COOLDOWN_MS - elapsed);
}

/**
 * Formats remaining cooldown into a human-readable string like "42s".
 */
export function formatCooldown(ms: number): string {
  const secs = Math.ceil(ms / 1000);
  return secs > 60 ? `${Math.ceil(secs / 60)}m` : `${secs}s`;
}

// --- safeSignUp --------------------------------------------------------------

/**
 * Wraps `supabase.auth.signUp` with:
 *  - Client-side cooldown check
 *  - Rate limit error detection
 *  - Typed result with `rateLimited` and `sessionReady` flags
 */
export async function safeSignUp(
  supabase: SupabaseClient,
  email: string,
  password: string
): Promise<SafeSignUpResult> {
  // Client-side gate: don't even attempt if browser-local cooldown is active
  const cooldown = getEmailCooldownRemaining();
  if (cooldown > 0) {
    return {
      userId: null,
      sessionReady: false,
      needsEmailConfirmation: false,
      rateLimited: true,
      error: `Please wait ${formatCooldown(cooldown)} before registering another account.`,
    };
  }

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });

    // Record the attempt timestamp regardless of outcome
    setTimestamp(LS_LAST_SIGNUP_KEY);

    if (error) {
      const rateLimited = isEmailRateLimitError(error);
      return {
        userId: null,
        sessionReady: false,
        needsEmailConfirmation: false,
        rateLimited,
        error: rateLimited
          ? `Email rate limit reached. Please wait a few minutes before registering. You can still sign in if you already have an account.`
          : error.message || "Registration failed. Please try again.",
      };
    }

    const userId = data?.user?.id ?? null;
    // If session exists immediately -> Supabase "Confirm Email" is OFF -> user is live
    const sessionReady = !!(data?.session?.access_token);
    // If user exists but no session -> email confirmation is required
    const needsEmailConfirmation = !!userId && !sessionReady;

    return {
      userId,
      sessionReady,
      needsEmailConfirmation,
      rateLimited: false,
      error: null,
    };
  } catch (err: unknown) {
    const rateLimited = isEmailRateLimitError(err);
    return {
      userId: null,
      sessionReady: false,
      needsEmailConfirmation: false,
      rateLimited,
      error: rateLimited
        ? "Email rate limit reached. Please try again in a few minutes."
        : (err as any)?.message || "An unexpected error occurred.",
    };
  }
}

// --- attemptAutoSignIn -------------------------------------------------------

/**
 * After a successful signUp (when Supabase "Confirm Email" is OFF),
 * immediately sign the user in with their password to get a live session.
 * Returns the userId on success, null on failure.
 */
export async function attemptAutoSignIn(
  supabase: SupabaseClient,
  email: string,
  password: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data?.user?.id) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

// --- safeSendPasswordReset ----------------------------------------------------

/**
 * Wraps `supabase.auth.resetPasswordForEmail` with rate limit detection.
 * Replaces magic link (signInWithOtp) which heavily consumes email quota.
 */
export async function safeSendPasswordReset(
  supabase: SupabaseClient,
  email: string,
  redirectTo?: string
): Promise<{ sent: boolean; rateLimited: boolean; error: string | null }> {
  const cooldown = getEmailCooldownRemaining();
  if (cooldown > 0) {
    return {
      sent: false,
      rateLimited: true,
      error: `Please wait ${formatCooldown(cooldown)} before requesting another email.`,
    };
  }

  try {
    const opts = redirectTo ? { redirectTo } : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, opts);

    setTimestamp(LS_LAST_EMAIL_KEY);

    if (error) {
      const rateLimited = isEmailRateLimitError(error);
      return {
        sent: false,
        rateLimited,
        error: rateLimited
          ? "Email rate limit reached. Please wait a few minutes before requesting another reset link."
          : error.message || "Failed to send reset email.",
      };
    }

    return { sent: true, rateLimited: false, error: null };
  } catch (err: unknown) {
    const rateLimited = isEmailRateLimitError(err);
    return {
      sent: false,
      rateLimited,
      error: rateLimited
        ? "Email rate limit reached. Please try again in a few minutes."
        : (err as any)?.message || "An unexpected error occurred.",
    };
  }
}
