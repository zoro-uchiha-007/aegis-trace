import { NextRequest, NextResponse } from 'next/server';
import { geolocateBatch } from '@/lib/services/geolocation';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ips } = body;

    if (!ips || !Array.isArray(ips)) {
      return NextResponse.json(
        { error: 'Missing or invalid "ips" array in request body' },
        { status: 400 }
      );
    }

    const records = await geolocateBatch(ips);
    return NextResponse.json({
      success: true,
      count: records.length,
      records,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error in geolocate batch route' },
      { status: 500 }
    );
  }
}
