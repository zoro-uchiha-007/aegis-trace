import { NextRequest, NextResponse } from 'next/server';

/**
 * Gmail OAuth Callback Handler
 * Exchanges the authorization code for access + refresh tokens
 * Redirects back to stage-1 with token stored as query param (client picks it up)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  // Determine origin and redirectUri matching what the client sent
  const stateOrigin =
    state && (state.startsWith('http://') || state.startsWith('https://'))
      ? new URL(state).origin
      : null;

  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const headerOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : null;

  const origin = stateOrigin || headerOrigin || new URL(request.url).origin;
  const redirectUri = state || `${origin}/api/gmail/auth`;

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/stage-1-fast-triage?gmail_error=${encodeURIComponent(error || 'no_code')}`, origin),
    );
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL('/stage-1-fast-triage?gmail_error=missing_credentials', origin),
    );
  }

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Token exchange failed:', errText);
      let errorDetail = 'token_exchange_failed';
      try {
        const parsed = JSON.parse(errText);
        errorDetail = parsed.error_description || parsed.error || errText;
      } catch {
        errorDetail = errText || 'token_exchange_failed';
      }
      return NextResponse.redirect(
        new URL(`/stage-1-fast-triage?gmail_error=${encodeURIComponent(errorDetail)}`, origin),
      );
    }

    const tokenData = await tokenRes.json();
    const { access_token, expires_in } = tokenData;

    // Fetch user email for display
    let userEmail = '';
    try {
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        userEmail = profile.email || '';
      }
    } catch {
      // non-critical
    }

    // Redirect back to stage-1 with token info in query params
    // The client will store these in sessionStorage
    const redirectUrl = new URL('/stage-1-fast-triage', origin);
    redirectUrl.searchParams.set('gmail_token', access_token);
    redirectUrl.searchParams.set('gmail_expires_in', String(expires_in || 3600));
    if (userEmail) {
      redirectUrl.searchParams.set('gmail_email', userEmail);
    }

    return NextResponse.redirect(redirectUrl);
  } catch (err: any) {
    console.error('Gmail OAuth error:', err);
    return NextResponse.redirect(
      new URL(`/stage-1-fast-triage?gmail_error=server_error`, origin),
    );
  }
}
