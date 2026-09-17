import { NextRequest, NextResponse } from 'next/server';
import { geolocateIP } from '@/lib/services/geolocation';

/**
 * GET /api/geolocation/{ip}
 *
 * Resolves a single public IPv4 address to geolocation data via ipinfo.io.
 * On failure returns { locationUnavailable: true, reason } — NEVER fake coordinates.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { ip: string } }
) {
  const ip = (params.ip ?? '').trim();

  if (!ip) {
    return NextResponse.json({ error: 'IP address is required' }, { status: 400 });
  }

  // Basic IPv4 format validation before hitting the provider
  const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
  if (!IPV4_RE.test(ip)) {
    return NextResponse.json(
      {
        locationUnavailable: true,
        reason: `Invalid IPv4 address format: "${ip}"`,
        ip,
      },
      { status: 400 }
    );
  }

  try {
    const result = await geolocateIP(ip);

    if (!result.success || result.locationUnavailable) {
      // Return 200 so the client can handle gracefully without try/catch on HTTP status
      return NextResponse.json({
        locationUnavailable: true,
        reason:
          result.error ??
          'Location unavailable — geolocation provider did not return valid coordinates.',
        ip,
      });
    }

    return NextResponse.json({
      success: true,
      ip,
      source: result.source,
      data: result.data,
    });
  } catch (err: any) {
    console.error(`[AEGIS-GEO] Unexpected error for IP ${ip}:`, err);
    return NextResponse.json({
      locationUnavailable: true,
      reason: 'Location unavailable — internal server error during geolocation lookup.',
      ip,
    });
  }
}
