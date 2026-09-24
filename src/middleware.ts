import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ─── Routes ───────────────────────────────────────────────────────────────────

/** Routes that do NOT require authentication (public routes) */
const PUBLIC_ROUTES = ['/login', '/safety-intervention'];

// ─── Load Balancer ────────────────────────────────────────────────────────────

/**
 * Application-level round-robin load balancer.
 *
 * Configuration (via environment variables):
 *   LB_ENABLED   = "true"  to activate load balancing (default: false)
 *   LB_BACKENDS  = Comma-separated list of backend base URLs to distribute to.
 *                  Example: "https://app1.aegis.internal,https://app2.aegis.internal"
 *
 * When enabled, all /api/* requests are rewritten to the next backend in the
 * ring. A module-level counter provides round-robin across requests within
 * the same worker process. The current route path + query string is preserved.
 *
 * Falls back to normal routing if:
 *   - LB_ENABLED is not "true"
 *   - No backends are configured
 *   - Only one backend is configured (no point rewriting)
 */

/** Module-level counter — survives across requests in the same edge worker */
let lbCounter = 0;

function getLoadBalancedResponse(request: NextRequest): NextResponse | null {
  // Feature flag check
  if (process.env.LB_ENABLED !== 'true') return null;

  // Only load-balance API routes
  if (!request.nextUrl.pathname.startsWith('/api')) return null;

  // Parse backend list
  const raw = process.env.LB_BACKENDS || '';
  const backends = raw
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);

  // Need at least 2 backends to be worth balancing
  if (backends.length < 2) return null;

  // Round-robin selection
  const index = lbCounter % backends.length;
  lbCounter = (lbCounter + 1) % Number.MAX_SAFE_INTEGER; // prevent overflow

  const selectedBackend = backends[index];

  try {
    // Rewrite: replace origin with selected backend, keep path + search
    const targetUrl = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      selectedBackend
    );

    const response = NextResponse.rewrite(targetUrl);
    // Add diagnostic header so you can verify in DevTools
    response.headers.set('X-LB-Backend', String(index + 1));
    response.headers.set('X-LB-Target', selectedBackend);
    return response;
  } catch {
    // If URL construction fails (bad backend config), fall through to normal routing
    return null;
  }
}

// ─── Main Middleware ──────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Load balancer: intercept /api/* first ──
  const lbResponse = getLoadBalancedResponse(request);
  if (lbResponse) return lbResponse;

  // ── Auth protection ──
  // Allow public routes and static assets
  if (
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check for session token in cookies (set on login)
  const sessionToken = request.cookies.get('aegis_session')?.value;

  // If no session, redirect to login
  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Match all routes except static files and API routes
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
