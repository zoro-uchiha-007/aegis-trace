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

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/stage-1-fast-triage?gmail_error=${error || 'no_code'}`, request.url),
    );
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${new URL(request.url).origin}/api/gmail/auth`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL('/stage-1-fast-triage?gmail_error=missing_credentials', request.url),
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
      return NextResponse.redirect(
        new URL('/stage-1-fast-triage?gmail_error=token_exchange_failed', request.url),
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
    const redirectUrl = new URL('/stage-1-fast-triage', request.url);
    redirectUrl.searchParams.set('gmail_token', access_token);
    redirectUrl.searchParams.set('gmail_expires_in', String(expires_in || 3600));
    redirectUrl.searchParams.set('gmail_email', userEmail);

    return NextResponse.redirect(redirectUrl);
  } catch (err: any) {
    console.error('Gmail OAuth error:', err);
    return NextResponse.redirect(
      new URL(`/stage-1-fast-triage?gmail_error=server_error`, request.url),
    );
  }
}
