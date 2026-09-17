import { IPGeolocationRecord } from '../supabase/types';
import { getSupabaseServerClient } from '../supabase/server';
import { isPrivateOrReservedIP } from '../utils/geo-math';

export interface GeoLookupResult {
  success: boolean;
  data?: IPGeolocationRecord;
  error?: string;
  locationUnavailable?: boolean;
  source: 'cache' | 'ipinfo' | 'unavailable';
}

function isValidCoordinate(lat: number, lng: number): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

function logGeoDebug(info: {
  requestedIP: string;
  resolvedIP?: string;
  lat?: number;
  lng?: number;
  city?: string;
  country?: string;
  provider: string;
  status: 'hit' | 'miss' | 'error' | 'invalid_coords' | 'private';
}) {
  console.log(
    `[AEGIS-GEO] ${new Date().toISOString()} | ` +
    `Requested IP: ${info.requestedIP} | ` +
    `Resolved IP: ${info.resolvedIP ?? 'N/A'} | ` +
    `Latitude: ${info.lat ?? 'N/A'} | ` +
    `Longitude: ${info.lng ?? 'N/A'} | ` +
    `City: ${info.city ?? 'N/A'} | ` +
    `Country: ${info.country ?? 'N/A'} | ` +
    `Provider: ${info.provider} | ` +
    `Status: ${info.status}`
  );
}

function parseASNAndISP(orgString?: string): { asn: string; isp: string } {
  if (!orgString) return { asn: 'AS-UNKNOWN', isp: 'Unknown Provider' };
  const trimmed = orgString.trim();
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx > 0 && trimmed.toUpperCase().startsWith('AS')) {
    return { asn: trimmed.substring(0, spaceIdx), isp: trimmed.substring(spaceIdx + 1) };
  }
  return { asn: 'AS-N/A', isp: trimmed };
}

/**
 * Resolves an IP to geolocation via ipinfo.io.
 * NEVER returns hardcoded/fake coordinates on failure.
 * Returns locationUnavailable: true instead.
 */
export async function geolocateIP(
  ip: string,
  expectedCountry: string = 'IN'
): Promise<GeoLookupResult> {
  const cleanIp = (ip || '').trim();

  if (!cleanIp) {
    return { success: false, error: 'Empty IP address provided', locationUnavailable: true, source: 'unavailable' };
  }

  if (isPrivateOrReservedIP(cleanIp)) {
    logGeoDebug({ requestedIP: cleanIp, provider: 'none', status: 'private' });
    return {
      success: false,
      error: `${cleanIp} is a private/reserved IP — geolocation not applicable.`,
      locationUnavailable: true,
      source: 'unavailable',
    };
  }

  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: cached, error } = await supabase
        .from('ip_geolocation')
        .select('*')
        .eq('ip', cleanIp)
        .gte('looked_up_at', thirtyDaysAgo)
        .single();

      if (cached && !error) {
        if (isValidCoordinate(cached.lat, cached.lng)) {
          logGeoDebug({
            requestedIP: cleanIp, resolvedIP: cached.ip,
            lat: cached.lat, lng: cached.lng,
            city: cached.city, country: cached.country,
            provider: 'supabase-cache', status: 'hit',
          });
          return { success: true, data: cached as IPGeolocationRecord, source: 'cache' };
        } else {
          console.warn(`[AEGIS-GEO] Cached record for ${cleanIp} has invalid coords (${cached.lat}, ${cached.lng}) — deleting and re-fetching.`);
          await supabase.from('ip_geolocation').delete().eq('ip', cleanIp);
        }
      }
    } catch (err) {
      console.warn(`[AEGIS-GEO] Cache lookup failed for IP ${cleanIp}:`, err);
    }
  }

  const token = process.env.IPINFO_TOKEN;
  const url = token
    ? `https://ipinfo.io/${encodeURIComponent(cleanIp)}?token=${encodeURIComponent(token)}`
    : `https://ipinfo.io/${encodeURIComponent(cleanIp)}/json`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': 'AEGIS-TRACE-Forensics/2.0' },
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`ipinfo HTTP ${res.status}: ${res.statusText}`);

    const payload = await res.json();

    if (payload.bogon) {
      logGeoDebug({ requestedIP: cleanIp, provider: 'ipinfo', status: 'miss' });
      return {
        success: false,
        error: `${cleanIp} is a bogon/unroutable IP — no geolocation available.`,
        locationUnavailable: true,
        source: 'unavailable',
      };
    }

    let lat = NaN;
    let lng = NaN;
    if (payload.loc && typeof payload.loc === 'string') {
      const parts = payload.loc.split(',');
      if (parts.length === 2) {
        lat = parseFloat(parts[0]);
        lng = parseFloat(parts[1]);
      }
    }

    if (!isValidCoordinate(lat, lng)) {
      logGeoDebug({
        requestedIP: cleanIp, resolvedIP: payload.ip,
        lat, lng, city: payload.city, country: payload.country,
        provider: 'ipinfo', status: 'invalid_coords',
      });
      return {
        success: false,
        error: `Location unavailable — geolocation provider did not return valid coordinates for ${cleanIp}.`,
        locationUnavailable: true,
        source: 'unavailable',
      };
    }

    const { asn, isp } = parseASNAndISP(payload.org);
    const countryCode = payload.country || 'UNKNOWN';
    const isAnomalous = expectedCountry ? countryCode !== expectedCountry : false;

    const newRecord: IPGeolocationRecord = {
      id: crypto.randomUUID ? crypto.randomUUID() : `geo-${Date.now()}`,
      ip: cleanIp,
      lat,
      lng,
      city: payload.city || 'Unknown City',
      region: payload.region || 'Unknown Region',
      country: payload.country_name || payload.country || 'Unknown Country',
      country_code: countryCode,
      asn,
      isp,
      org: payload.org || `${asn} ${isp}`,
      timezone: payload.timezone || 'UTC',
      is_anomalous: isAnomalous,
      looked_up_at: new Date().toISOString(),
    };

    logGeoDebug({
      requestedIP: cleanIp, resolvedIP: newRecord.ip,
      lat: newRecord.lat, lng: newRecord.lng,
      city: newRecord.city, country: newRecord.country,
      provider: 'ipinfo', status: 'hit',
    });

    if (supabase) {
      try {
        await supabase.from('ip_geolocation').upsert(
          {
            ip: newRecord.ip, lat: newRecord.lat, lng: newRecord.lng,
            city: newRecord.city, region: newRecord.region,
            country: newRecord.country, country_code: newRecord.country_code,
            asn: newRecord.asn, isp: newRecord.isp, org: newRecord.org,
            timezone: newRecord.timezone, is_anomalous: newRecord.is_anomalous,
            looked_up_at: newRecord.looked_up_at,
          },
          { onConflict: 'ip' }
        );
      } catch (upsertErr) {
        console.warn('[AEGIS-GEO] Failed to cache IP record:', upsertErr);
      }
    }

    return { success: true, data: newRecord, source: 'ipinfo' };

  } catch (apiErr: any) {
    const isTimeout = apiErr?.name === 'AbortError';
    logGeoDebug({ requestedIP: cleanIp, provider: 'ipinfo', status: 'error' });
    console.warn(`[AEGIS-GEO] Lookup failed for ${cleanIp}:`, apiErr?.message);
    return {
      success: false,
      error: isTimeout
        ? `Location unavailable — request timed out for ${cleanIp}.`
        : `Location unavailable — geolocation provider did not return valid coordinates for ${cleanIp}.`,
      locationUnavailable: true,
      source: 'unavailable',
    };
  }
}

/**
 * Batch resolver. Returns only successful records — failed lookups are omitted, never fake-filled.
 */
export async function geolocateBatch(
  ips: string[],
  concurrencyLimit: number = 3
): Promise<IPGeolocationRecord[]> {
  const results: IPGeolocationRecord[] = [];
  const uniqueIps = Array.from(new Set(ips.filter(Boolean)));

  for (let i = 0; i < uniqueIps.length; i += concurrencyLimit) {
    const chunk = uniqueIps.slice(i, i + concurrencyLimit);
    const promises = chunk.map(async (ip) => {
      const res = await geolocateIP(ip);
      return res.success ? res.data : null;
    });
    const chunkResults = await Promise.all(promises);
    for (const record of chunkResults) {
      if (record) results.push(record);
    }
  }

  return results;
}
