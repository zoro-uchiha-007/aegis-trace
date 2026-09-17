'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { setSessionCookie, getOrCreateGuestId } from '@/lib/auth';
import { reloadStateForUser } from '@/lib/services/cases';
import {
  safeSignUp,
  attemptAutoSignIn,
  safeSendPasswordReset,
  getEmailCooldownRemaining,
  formatCooldown,
} from '@/lib/supabase/auth-helpers';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';

  // Sign In state — empty by default
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPass, setShowSignInPass] = useState(false);
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState('');

  // Register state — empty by default
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState('');
  const [regError, setRegError] = useState('');

  // Forgot password / reset state (replaces magic link OTP to save email quota)
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState('');

  // Client-side email cooldown countdown (seconds)
  const [cooldownSecs, setCooldownSecs] = useState(0);

  // Tick the cooldown counter every second
  useEffect(() => {
    const tick = () => {
      const remaining = getEmailCooldownRemaining();
      setCooldownSecs(remaining > 0 ? Math.ceil(remaining / 1000) : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /**
   * Full-page redirect after setting the cookie.
   * Using window.location.href (not router.push) so the browser sends a
   * fresh HTTP request that the server-side middleware can read the cookie from.
   */
  const navigateAfterLogin = (dest: string) => {
    window.location.href = dest;
  };

  const handleSignIn = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!signInEmail) {
      setSignInError('Please enter your email.');
      return;
    }
    if (!signInPassword) {
      setSignInError('Please enter your password.');
      return;
    }
    setSignInLoading(true);
    setSignInError('');

    const supabase = getSupabaseClient();
    if (!supabase) {
      setSignInError('Authentication service unavailable. Please check your connection.');
      setSignInLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: signInEmail,
        password: signInPassword,
      });

      if (error) {
        // Show the real auth error — wrong password, unverified email, etc.
        setSignInError(error.message || 'Invalid email or password.');
        setSignInLoading(false);
        return;
      }

      if (data?.user?.id) {
        setSessionCookie(data.user.id);
        reloadStateForUser();
        setSignInLoading(false);
        navigateAfterLogin(redirectTo);
        return;
      }

      setSignInError('Sign in failed. Please try again.');
      setSignInLoading(false);
    } catch (err: any) {
      setSignInError(err?.message || 'An unexpected error occurred.');
      setSignInLoading(false);
    }
  };

  const handleQuickDemo = () => {
    // Each browser gets a stable isolated guest session
    const guestId = getOrCreateGuestId();
    setSessionCookie(guestId);
    reloadStateForUser();
    setTimeout(() => navigateAfterLogin(redirectTo), 50);
  };

  const handleRegister = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    setRegLoading(true);
    setRegError('');
    setRegSuccess('');

    if (!regEmail) {
      setRegError('Please enter an email address.');
      setRegLoading(false);
      return;
    }
    if (!regPassword) {
      setRegError('Please enter a password.');
      setRegLoading(false);
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match.');
      setRegLoading(false);
      return;
    }
    if (regPassword.length < 6) {
      setRegError('Password must be at least 6 characters.');
      setRegLoading(false);
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setRegError('Authentication service unavailable. Please check your connection.');
      setRegLoading(false);
      return;
    }

    // Use safeSignUp — handles rate-limit detection and client-side cooldown
    const result = await safeSignUp(supabase, regEmail, regPassword);

    if (result.error) {
      setRegError(result.error);
      setRegLoading(false);
      return;
    }

    if (result.sessionReady && result.userId) {
      // Supabase "Confirm Email" is OFF — user is immediately active
      setSessionCookie(result.userId);
      reloadStateForUser();
      setRegLoading(false);
      setRegSuccess('Account created! Redirecting to investigation console...');
      setTimeout(() => navigateAfterLogin(redirectTo), 1000);
      return;
    }

    if (result.userId && result.needsEmailConfirmation) {
      // Try auto sign-in first (in case confirm-email was recently disabled)
      const autoId = await attemptAutoSignIn(supabase, regEmail, regPassword);
      if (autoId) {
        setSessionCookie(autoId);
        reloadStateForUser();
        setRegLoading(false);
        setRegSuccess('Account created! Redirecting to investigation console...');
        setTimeout(() => navigateAfterLogin(redirectTo), 1000);
        return;
      }
      // Fallback: email confirmation required
      setRegLoading(false);
      setRegSuccess(
        '✓ Registration successful — check your email to confirm your account, then sign in.'
      );
      return;
    }

    setRegError('Registration failed. Please try again.');
    setRegLoading(false);
  };

  /**
   * Replaced magic link (signInWithOtp) with password reset.
   * Magic link aggressively consumes Supabase's 3 emails/hr free quota.
   * resetPasswordForEmail uses a separate, more generous quota.
   */
  const handleForgotPassword = async () => {
    setForgotError('');
    if (!signInEmail) {
      setForgotError('Enter your email above first.');
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      setForgotError('Authentication service unavailable.');
      return;
    }
    const result = await safeSendPasswordReset(supabase, signInEmail);
    if (result.error) {
      setForgotError(result.error);
      return;
    }
    setForgotSent(true);
    setTimeout(() => setForgotSent(false), 5000);
  };

  return (
    <div className="relative z-10 w-full max-w-5xl bg-surface-container-low/95 backdrop-blur-md rounded-xl p-6 sm:p-8 shadow-2xl flex flex-col gap-8 border border-outline-variant/30 my-auto">
      {/* Header Section */}
      <div className="flex flex-wrap items-center justify-between border-b border-outline-variant/20 pb-6 gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-primary shadow-inner border border-primary/20">
            <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              shield_with_house
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
                AEGIS-TRACE
              </h1>
              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono font-bold">
                v2.4 SEC-GATE
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 tracking-wide uppercase">
              Tactical Forensics &amp; Neural Defense Portal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleQuickDemo}
            className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-code-sm text-xs font-bold transition-all border border-primary/30"
          >
            ⚡ Quick Demo Access
          </button>
        </div>
      </div>

      {/* Side-by-Side Split: Sign In (Left) and Create Account (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        {/* Column 1: Sign In */}
        <div className="flex flex-col justify-between bg-surface-container-lowest/70 p-6 rounded-xl border border-outline-variant/30">
          <div>
            <div className="flex items-center justify-between pb-3 mb-5 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">lock_open</span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Sign In</h2>
              </div>
              <span className="font-label-sm text-label-sm text-outline-variant uppercase tracking-wider">
                Existing Account
              </span>
            </div>

            {/* Cooldown banner — shown when email quota is locally exhausted */}
            {cooldownSecs > 0 && (
              <div className="mb-4 p-2.5 rounded bg-warning-container/20 border border-warning/40 text-warning text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">timer</span>
                Email cooldown active — wait <span className="font-mono font-bold">{cooldownSecs}s</span> before sending another email.
              </div>
            )}

            {signInError && (
              <div className="mb-4 p-2.5 rounded bg-error-container/30 border border-error/40 text-error text-xs">
                {signInError}
              </div>
            )}

            <form onSubmit={handleSignIn} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider text-xs">
                  Username or Email
                </label>
                <div className="relative flex items-center bg-surface-container rounded-lg px-3.5 py-2.5 border border-outline-variant/30 focus-within:border-primary/50 transition-colors">
                  <span className="material-symbols-outlined text-[18px] text-outline mr-2.5">person</span>
                  <input
                    className="w-full bg-transparent font-body-md text-body-md text-on-surface focus:outline-none placeholder:text-outline-variant"
                    placeholder="analyst@soc.aegis.internal"
                    type="text"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider text-xs">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="font-body-sm text-xs text-primary hover:underline underline-offset-4 transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative flex items-center bg-surface-container rounded-lg px-3.5 py-2.5 border border-outline-variant/30 focus-within:border-primary/50 transition-colors">
                  <span className="material-symbols-outlined text-[18px] text-outline mr-2.5">lock</span>
                  <input
                    className="w-full bg-transparent font-code-md text-code-md text-on-surface focus:outline-none tracking-wider"
                    placeholder="Enter password"
                    type={showSignInPass ? 'text' : 'password'}
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    className="text-outline hover:text-on-surface transition-colors p-1"
                    onClick={() => setShowSignInPass(!showSignInPass)}
                    type="button"
                    aria-label="Toggle password visibility"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showSignInPass ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {forgotSent && (
                <div className="p-2 rounded bg-tertiary-container/20 text-tertiary text-xs border border-tertiary/30">
                  ✓ Password reset link sent to {signInEmail} — check your inbox.
                </div>
              )}
              {forgotError && (
                <div className="p-2 rounded bg-error-container/20 text-error text-xs border border-error/30">
                  {forgotError}
                </div>
              )}
            </form>
          </div>

          <div className="pt-6">
            <button
              onClick={handleSignIn}
              disabled={signInLoading}
              className="w-full py-3.5 px-6 rounded-lg bg-primary text-on-primary font-body-lg text-body-lg font-semibold flex items-center justify-center gap-2 transition-all hover:bg-primary-container active:scale-[0.99] shadow-lg hover:shadow-primary/20"
              type="button"
            >
              <span>{signInLoading ? 'Authenticating...' : 'Sign In'}</span>
              <span className="material-symbols-outlined text-[20px]">
                {signInLoading ? 'sync' : 'arrow_forward'}
              </span>
            </button>
          </div>
        </div>

        {/* Column 2: Create Account / Register */}
        <div className="flex flex-col justify-between bg-surface-container-lowest/70 p-6 rounded-xl border border-outline-variant/30">
          <div>
            <div className="flex items-center justify-between pb-3 mb-5 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-tertiary">person_add</span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Create Account</h2>
              </div>
              <span className="font-label-sm text-label-sm text-tertiary uppercase tracking-wider">
                New Registration
              </span>
            </div>

            {regSuccess && (
              <div className="mb-4 p-2.5 rounded bg-tertiary-container/30 border border-tertiary/40 text-tertiary text-xs">
                {regSuccess}
              </div>
            )}
            {regError && (
              <div className="mb-4 p-2.5 rounded bg-error-container/30 border border-error/40 text-error text-xs">
                {regError}
              </div>
            )}

            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider text-xs">
                  Username or Email
                </label>
                <div className="relative flex items-center bg-surface-container rounded-lg px-3.5 py-2.5 border border-outline-variant/30 focus-within:border-primary/50 transition-colors">
                  <span className="material-symbols-outlined text-[18px] text-outline mr-2.5">
                    alternate_email
                  </span>
                  <input
                    className="w-full bg-transparent font-body-md text-body-md text-on-surface focus:outline-none placeholder:text-outline-variant"
                    placeholder="e.g. specialist@soc.aegis.internal"
                    type="text"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider text-xs">
                  Password
                </label>
                <div className="relative flex items-center bg-surface-container rounded-lg px-3.5 py-2.5 border border-outline-variant/30 focus-within:border-primary/50 transition-colors">
                  <span className="material-symbols-outlined text-[18px] text-outline mr-2.5">lock</span>
                  <input
                    className="w-full bg-transparent font-code-md text-code-md text-on-surface focus:outline-none tracking-wider"
                    placeholder="Create password"
                    type={showRegPass ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    className="text-outline hover:text-on-surface transition-colors p-1"
                    onClick={() => setShowRegPass(!showRegPass)}
                    type="button"
                    aria-label="Toggle password visibility"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showRegPass ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <span className="text-[10px] text-on-surface-variant font-code-sm">Minimum 6 characters</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider text-xs">
                  Confirm Password
                </label>
                <div className="relative flex items-center bg-surface-container rounded-lg px-3.5 py-2.5 border border-outline-variant/30 focus-within:border-primary/50 transition-colors">
                  <span className="material-symbols-outlined text-[18px] text-outline mr-2.5">lock_reset</span>
                  <input
                    className="w-full bg-transparent font-code-md text-code-md text-on-surface focus:outline-none tracking-wider"
                    placeholder="Re-enter password"
                    type={showRegPass ? 'text' : 'password'}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </form>
          </div>

          <div className="pt-6">
            <button
              onClick={handleRegister}
              disabled={regLoading}
              className="w-full py-3.5 px-6 rounded-lg bg-surface-container-high hover:bg-surface-bright text-primary border border-primary/30 hover:border-primary font-body-lg text-body-lg font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-md"
              type="button"
            >
              <span>{regLoading ? 'Registering...' : 'Register'}</span>
              <span className="material-symbols-outlined text-[20px]">
                {regLoading ? 'sync' : 'how_to_reg'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative w-full min-h-screen flex flex-col justify-between items-center py-10 px-4 sm:px-6 overflow-hidden bg-surface-container-lowest">
      {/* Coordinate Mesh & Ambient Energy Layer */}
      <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(#06b6d4_0.75px,transparent_0.75px)] [background-size:24px_24px]" />
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary-container/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-secondary-container/15 blur-3xl pointer-events-none" />

      {/* Wrap in Suspense for useSearchParams compatibility */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center w-full h-64">
            <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
          </div>
        }
      >
        <LoginForm />
      </Suspense>

      {/* Footer */}
      <div className="relative z-10 text-center text-xs text-on-surface-variant font-code-sm mt-4">
        AEGIS-TRACE Autonomous Cyber Defense Framework • FIPS 140-3 Cryptographic Integrity
      </div>
    </div>
  );
}
