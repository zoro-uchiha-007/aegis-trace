import { NextRequest, NextResponse } from 'next/server';
import { geolocateIP } from '@/lib/services/geolocation';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ip, expectedCountry } = body;

    if (!ip || typeof ip !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "ip" parameter' },
        { status: 400 }
      );
    }

    const result = await geolocateIP(ip, expectedCountry || 'US');
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error in geolocate route' },
      { status: 500 }
    );
  }
}
