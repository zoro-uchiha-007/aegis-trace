import * as turf from '@turf/turf';

/**
 * Calculates Haversine distance in kilometers between two coordinates [lat, lng]
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Calculates total route distance across sequential hops
 */
export function calculateTotalRouteDistance(
  coords: Array<{ lat: number; lng: number }>
): number {
  if (coords.length < 2) return 0;
  let totalKm = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    totalKm += calculateHaversineDistance(
      coords[i].lat,
      coords[i].lng,
      coords[i + 1].lat,
      coords[i + 1].lng
    );
  }
  return totalKm;
}

/**
 * Generates true geodesic Great-Circle LineString GeoJSON between two coordinates [lng, lat]
 */
export function generateGreatCircleArc(
  startLngLat: [number, number],
  endLngLat: [number, number],
  npoints: number = 100
): GeoJSON.Feature<GeoJSON.LineString> {
  const startPoint = turf.point(startLngLat);
  const endPoint = turf.point(endLngLat);
  
  try {
    const arc = turf.greatCircle(startPoint, endPoint, {
      npoints,
      properties: {
        start: startLngLat,
        end: endLngLat,
      },
    });
    return arc as GeoJSON.Feature<GeoJSON.LineString>;
  } catch (err) {
    // Fallback simple line if turf error
    return turf.lineString([startLngLat, endLngLat]);
  }
}

/**
 * Checks if an IP is in a private, loopback, or reserved range
 */
export function isPrivateOrReservedIP(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return true;
  const cleanIp = ip.trim();

  // Unspecified / broadcast
  if (cleanIp === '0.0.0.0' || cleanIp === '255.255.255.255') return true;

  // Loopback / localhost
  if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp.startsWith('127.')) return true;

  // RFC1918 Private ranges
  // 10.0.0.0 - 10.255.255.255
  if (cleanIp.startsWith('10.')) return true;
  // 192.168.0.0 - 192.168.255.255
  if (cleanIp.startsWith('192.168.')) return true;
  // 192.0.2.0/24 — RFC5737 TEST-NET-1 (documentation)
  if (cleanIp.startsWith('192.0.2.')) return true;

  const parts = cleanIp.split('.').map(Number);
  if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
    // 172.16.0.0 - 172.31.255.255 (RFC1918)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 100.64.0.0/10 — Carrier-grade NAT
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    // 169.254.0.0/16 — Link local
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 198.51.100.0/24 — RFC5737 TEST-NET-2 (documentation)
    if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true;
    // 203.0.113.0/24 — RFC5737 TEST-NET-3 (documentation)
    if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true;
    // 240.0.0.0/4 — Reserved / Future use
    if (parts[0] >= 240) return true;
  }

  return false;
}
