'use client';

// ─── Gmail OAuth + API Client ─────────────────────────────────────────────────
// Handles PKCE-based OAuth flow, token storage, inbox polling, and raw EML fetch.

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

const REDIRECT_URI =
  typeof window !== 'undefined'
    ? `${window.location.origin}/api/gmail/auth`
    : 'http://localhost:3000/api/gmail/auth';

const TOKEN_KEY = 'aegis_gmail_token';
const TOKEN_EXPIRY_KEY = 'aegis_gmail_token_expiry';
const USER_EMAIL_KEY = 'aegis_gmail_user_email';

// ─── Token Storage ────────────────────────────────────────────────────────────

export function saveGmailToken(token: string, expiresInSeconds: number, userEmail?: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(
    TOKEN_EXPIRY_KEY,
    String(Date.now() + expiresInSeconds * 1000),
  );
  if (userEmail) sessionStorage.setItem(USER_EMAIL_KEY, userEmail);
}

export function getGmailToken(): string | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!token || !expiry) return null;
  if (Date.now() > parseInt(expiry, 10)) {
    clearGmailToken();
    return null;
  }
  return token;
}

export function getGmailUserEmail(): string | null {
  return sessionStorage.getItem(USER_EMAIL_KEY);
}

export function clearGmailToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
  sessionStorage.removeItem(USER_EMAIL_KEY);
}

export function isGmailConnected(): boolean {
  return getGmailToken() !== null;
}

// ─── OAuth PKCE Flow ──────────────────────────────────────────────────────────

function generateCodeVerifier(): string {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...Array.from(array)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...Array.from(new Uint8Array(digest))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export async function initiateGmailOAuth() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local');

  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  // Store verifier for callback
  sessionStorage.setItem('aegis_pkce_verifier', verifier);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: GMAIL_SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// ─── Gmail API Calls ──────────────────────────────────────────────────────────

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  fromAddress: string;
  to: string;
  date: string;
  isUnread: boolean;
  labelIds: string[];
  sizeEstimate: number;
}

/** Fetch the latest N messages from the inbox */
export async function fetchInboxMessages(maxResults = 20): Promise<GmailMessage[]> {
  const token = getGmailToken();
  if (!token) throw new Error('Not authenticated with Gmail');

  // List messages
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!listRes.ok) {
    if (listRes.status === 401) clearGmailToken();
    throw new Error(`Gmail API error: ${listRes.status}`);
  }

  const listData = await listRes.json();
  const messages: { id: string; threadId: string }[] = listData.messages || [];

  if (messages.length === 0) return [];

  // Fetch metadata for each message in parallel (batch up to 20)
  const metaBatch = messages.slice(0, 20).map((m) =>
    fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${token}` } },
    ).then((r) => r.json()),
  );

  const metaResults = await Promise.all(metaBatch);

  return metaResults.map((msg) => {
    const headers: { name: string; value: string }[] = msg.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const fromFull = getHeader('From');
    const fromAddress = fromFull.match(/<(.+?)>/)?.[1] || fromFull;

    return {
      id: msg.id,
      threadId: msg.threadId,
      snippet: msg.snippet || '',
      subject: getHeader('Subject') || '(no subject)',
      from: fromFull,
      fromAddress,
      to: getHeader('To'),
      date: getHeader('Date'),
      isUnread: (msg.labelIds || []).includes('UNREAD'),
      labelIds: msg.labelIds || [],
      sizeEstimate: msg.sizeEstimate || 0,
    };
  });
}

/** Fetch raw RFC-822 EML content for a specific message */
export async function fetchRawEml(messageId: string): Promise<string> {
  const token = getGmailToken();
  if (!token) throw new Error('Not authenticated with Gmail');

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=raw`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) throw new Error(`Failed to fetch message: ${res.status}`);

  const data = await res.json();

  // Gmail returns base64url-encoded raw RFC-822 content
  const raw: string = data.raw || '';
  // Decode base64url to string
  const base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = atob(base64);
  return decoded;
}

/** Get user's Gmail profile info */
export async function fetchGmailProfile(): Promise<{ emailAddress: string; messagesTotal: number }> {
  const token = getGmailToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Profile fetch error: ${res.status}`);
  return res.json();
}
