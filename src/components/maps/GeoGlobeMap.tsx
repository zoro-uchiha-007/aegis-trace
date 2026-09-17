'use client';

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { RouteHop, IPGeolocationRecord } from '@/lib/supabase/types';
import { generateGreatCircleArc, calculateTotalRouteDistance } from '@/lib/utils/geo-math';

interface GeoGlobeMapProps {
  hops: RouteHop[];
  onSelectHop?: (hop: RouteHop) => void;
}

// ─── Coordinate Validation ────────────────────────────────────────────────────

/** Returns true only if lat/lng are within valid geographic bounds and not (0,0). */
function hasValidCoords(geo?: IPGeolocationRecord | null): boolean {
  if (!geo) return false;
  const { lat, lng } = geo;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false; // (0,0) = Gulf of Guinea sentinel
  return true;
}

export const GeoGlobeMap: React.FC<GeoGlobeMapProps> = ({ hops, onSelectHop }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [selectedHop, setSelectedHop] = useState<RouteHop | null>(hops[0] || null);

  // Only hops with validated coordinates can be placed on the map
  const plottableHops = hops.filter((h) => hasValidCoords(h.geo));

  const validCoordinates = plottableHops.map((h) => ({
    lat: h.geo!.lat,
    lng: h.geo!.lng,
  }));

  const totalDistanceKm = calculateTotalRouteDistance(validCoordinates);

  // ── Map Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const mapStyle: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        'carto-dark': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        },
      },
      layers: [{ id: 'carto-dark-layer', type: 'raster', source: 'carto-dark', minzoom: 0, maxzoom: 19 }],
    };

    // Center on first plottable hop, or world view if none
    const initialCenter: [number, number] =
      plottableHops.length > 0
        ? [plottableHops[0].geo!.lng, plottableHops[0].geo!.lat]
        : [20, 20];
    const initialZoom = plottableHops.length > 0 ? 3 : 1.6;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    map.on('load', () => {
      // Draw great-circle arcs between plottable hops
      for (let i = 0; i < validCoordinates.length - 1; i++) {
        const start = validCoordinates[i];
        const end = validCoordinates[i + 1];
        const arcFeature = generateGreatCircleArc([start.lng, start.lat], [end.lng, end.lat], 80);

        const sourceId = `arc-source-${i}`;
        const layerId = `arc-layer-${i}`;
        const glowLayerId = `arc-glow-${i}`;

        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, { type: 'geojson', data: arcFeature });
          map.addLayer({ id: glowLayerId, type: 'line', source: sourceId,
            paint: { 'line-color': i === 0 ? '#ffb4ab' : '#4cd7f6', 'line-width': 6, 'line-opacity': 0.35, 'line-blur': 3 },
          });
          map.addLayer({ id: layerId, type: 'line', source: sourceId,
            paint: { 'line-color': i === 0 ? '#ffb4ab' : '#4cd7f6', 'line-width': 2.5, 'line-dasharray': [3, 2] },
          });
        }
      }

      // Add markers only for hops with valid coordinates
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      plottableHops.forEach((hop) => {
        const lat = hop.geo!.lat;
        const lng = hop.geo!.lng;

        let pinColor = '#4cd7f6';
        let pulseClass = 'bg-primary';
        let roleBadge = 'DESTINATION';

        if (hop.role === 'origin') {
          pinColor = '#ffb4ab';
          pulseClass = 'bg-error animate-ping';
          roleBadge = 'ATTACK ORIGIN';
        } else if (hop.role === 'relay') {
          pinColor = '#d0bcff';
          pulseClass = 'bg-secondary';
          roleBadge = 'ANON RELAY';
        }

        const el = document.createElement('div');
        el.className = 'custom-map-marker cursor-pointer';
        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-6 h-6 rounded-full opacity-60 ${pulseClass}"></span>
            <div class="relative w-7 h-7 rounded-full flex items-center justify-center border-2 border-white/80 shadow-lg text-[10px] font-bold text-[#0b0f19]" style="background-color: ${pinColor}">
              ${hop.hop_order}
            </div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(`
          <div class="p-1 text-xs" style="min-width:180px">
            <div class="font-bold uppercase tracking-wider text-[10px]" style="color:${pinColor}">${roleBadge} · Hop ${hop.hop_order}</div>
            <div class="font-bold text-sm text-[#dfe2f1] mt-0.5">${hop.geo?.city || 'Unknown'}, ${hop.geo?.region || ''}</div>
            <div class="text-[11px] text-[#bcc9cd]">${hop.geo?.country || 'Unknown Country'}</div>
            <div class="font-mono text-[11px] text-[#4cd7f6] mt-1">${hop.ip}</div>
            <div class="text-[10px] text-[#bcc9cd] mt-0.5">${hop.geo?.asn || 'AS-N/A'} · ${hop.geo?.isp || 'Unknown ISP'}</div>
            <div class="text-[10px] text-[#bcc9cd]">${hop.geo?.org || ''}</div>
            ${hop.is_anomalous ? '<div class="mt-1 px-1 py-0.5 rounded bg-red-900/60 text-red-200 text-[9px] font-bold uppercase">🚨 Country Anomaly Flagged</div>' : ''}
            <div class="mt-1.5 pt-1.5 border-t border-white/10 text-[9px] text-[#7a8fa6] italic">Approximate infrastructure location only</div>
          </div>
        `);

        el.addEventListener('click', () => {
          setSelectedHop(hop);
          if (onSelectHop) onSelectHop(hop);
          map.flyTo({ center: [lng, lat], zoom: 5, duration: 1200 });
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    });

    return () => { map.remove(); };
  }, [hops]);

  // ── Rotation ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    let animFrame: number;
    function rotate() {
      if (isRotating && map) {
        const center = map.getCenter();
        center.lng += 0.06;
        map.setCenter(center);
        animFrame = requestAnimationFrame(rotate);
      }
    }
    if (isRotating) animFrame = requestAnimationFrame(rotate);
    return () => cancelAnimationFrame(animFrame);
  }, [isRotating]);

  const focusHop = (hop: RouteHop) => {
    setSelectedHop(hop);
    if (onSelectHop) onSelectHop(hop);
    const map = mapInstanceRef.current;
    if (map && hasValidCoords(hop.geo)) {
      map.flyTo({ center: [hop.geo!.lng, hop.geo!.lat], zoom: 5, duration: 1200 });
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-space-md w-full">

      {/* Disclaimer Banner */}
      <div className="flex items-start gap-2 px-space-md py-2 rounded-lg bg-warning-container/15 border border-warning/25 text-warning text-xs font-body-sm">
        <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0">info</span>
        <span>
          <strong>Approximate infrastructure location only.</strong> IP geolocation indicates the approximate network/infrastructure location of the relay or mail server — it does not identify the attacker&apos;s exact physical location.
        </span>
      </div>

      {/* Header Metrics */}
      <div className="flex flex-wrap items-start justify-between gap-space-md bg-surface-container-low p-space-lg rounded-xl shadow-md border border-outline-variant/15">
        <div>
          <div className="flex items-center gap-space-xs mb-space-xs">
            <span className="px-space-xs py-0.5 rounded bg-primary/10 text-primary font-label-sm text-label-sm tracking-wider uppercase font-semibold">
              ROUTE TRACE
            </span>
            <span className="font-code-sm text-code-sm text-on-surface-variant">
              EMAIL DELIVERY PATH · GEOLOCATION TELEMETRY
            </span>
          </div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
            Email Infrastructure Routing Map
          </h2>
        </div>

        <div className="flex items-center gap-space-md">
          <div className="bg-surface-container px-space-md py-space-xs rounded-lg flex flex-col items-end border border-outline-variant/15">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase text-[10px]">PATH STEPS</span>
            <span className="font-code-lg text-code-lg text-primary font-bold">
              {plottableHops.length}/{hops.length} Hops Resolved
            </span>
          </div>
          {plottableHops.length > 1 && (
            <div className="bg-surface-container px-space-md py-space-xs rounded-lg flex flex-col items-end border border-outline-variant/15">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase text-[10px]">TOTAL DISTANCE (HAVERSINE)</span>
              <span className="font-code-lg text-code-lg text-secondary font-bold">
                ~{totalDistanceKm.toLocaleString()} km
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-md items-start">

        {/* Map (8 cols) */}
        <div className="xl:col-span-8 flex flex-col bg-surface-container-low rounded-xl p-space-lg shadow-xl border border-outline-variant/15 relative overflow-hidden">

          {/* Map Controls */}
          <div className="absolute top-6 right-6 z-20 flex items-center gap-2 bg-surface-container-high/90 backdrop-blur-md p-1.5 rounded-lg border border-outline-variant/30 shadow-lg">
            <button
              onClick={() => setIsRotating(!isRotating)}
              className={`px-2 py-1 rounded text-xs font-code-sm transition-colors flex items-center gap-1 ${
                isRotating ? 'bg-primary/20 text-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-sm">sync</span>
              <span>{isRotating ? 'Orbit On' : 'Orbit Off'}</span>
            </button>
          </div>

          {/* Map Canvas */}
          <div ref={mapContainerRef} className="w-full h-[460px] rounded-xl overflow-hidden bg-[#0b0f19] relative shadow-inner" />

          {/* Dynamic Legend — built from real hop data */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-outline-variant/15 text-xs font-code-sm text-on-surface-variant">
            <div className="flex flex-wrap items-center gap-4">
              {plottableHops.map((hop) => {
                const dotColor =
                  hop.role === 'origin' ? 'bg-error' :
                  hop.role === 'relay'  ? 'bg-secondary' : 'bg-primary';
                const city = hop.geo?.city || 'Unknown';
                const country = hop.geo?.country_code || '';
                return (
                  <div key={hop.id} className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 rounded-full ${dotColor}`} />
                    <span className="text-on-surface">
                      Hop {hop.hop_order}: {hop.role === 'origin' ? 'Origin' : hop.role === 'relay' ? 'Relay' : 'Destination'} ({city}{country ? `, ${country}` : ''})
                    </span>
                  </div>
                );
              })}
              {hops.length > plottableHops.length && (
                <div className="flex items-center gap-1.5 text-outline-variant">
                  <span className="w-3 h-3 rounded-full bg-outline-variant" />
                  <span>{hops.length - plottableHops.length} hop(s) — location unavailable</span>
                </div>
              )}
            </div>
            <span className="text-tertiary">Geodesic Great-Circle Arcs Active</span>
          </div>
        </div>

        {/* Side Panel: Hop Telemetry (4 cols) */}
        <div className="xl:col-span-4 flex flex-col gap-space-md">
          <div className="bg-surface-container-low rounded-xl p-space-lg shadow-xl border border-outline-variant/15 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">alt_route</span>
                <h3 className="font-headline-sm text-base text-on-surface font-semibold">Route Hops Telemetry</h3>
              </div>
              <span className="font-code-sm text-[11px] text-tertiary font-bold">{hops.length} NODES</span>
            </div>

            {/* No hops state */}
            {hops.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-6 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-3xl text-outline">location_off</span>
                <p className="font-body-sm text-sm">No public IPs found in email headers</p>
                <p className="text-xs text-outline">Upload an .eml file with Received headers to trace the routing path.</p>
              </div>
            )}

            {/* Hop list */}
            <div className="flex flex-col gap-2.5">
              {hops.map((hop) => {
                const isSelected = selectedHop?.id === hop.id;
                const hasGeo = hasValidCoords(hop.geo);

                let roleColor = 'text-primary border-primary/30 bg-primary/10';
                let badgeText = 'DESTINATION';
                if (hop.role === 'origin') { roleColor = 'text-error border-error/30 bg-error/10'; badgeText = 'ORIGIN'; }
                else if (hop.role === 'relay') { roleColor = 'text-secondary border-secondary/30 bg-secondary/10'; badgeText = 'RELAY'; }

                return (
                  <div
                    key={hop.id}
                    onClick={() => focusHop(hop)}
                    className={`p-3 rounded-lg bg-surface-container hover:bg-surface-container-high transition-all cursor-pointer border ${
                      isSelected ? 'border-primary ring-1 ring-primary/40 shadow-md' : 'border-outline-variant/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center font-code-sm text-xs font-bold text-on-surface">
                          {hop.hop_order}
                        </span>
                        <span className="font-body-sm text-xs font-bold text-on-surface">
                          {hasGeo
                            ? `${hop.geo!.city}, ${hop.geo!.country_code}`
                            : <span className="text-outline-variant italic">Location unavailable</span>
                          }
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-code-sm font-bold uppercase ${roleColor}`}>{badgeText}</span>
                    </div>

                    {/* SOURCE IP */}
                    <div className="font-code-sm text-xs font-semibold flex items-center justify-between mt-1">
                      <span className="text-primary">{hop.ip}</span>
                      <span className="text-on-surface-variant font-normal text-[11px]">{hop.latency_ms ? `${hop.latency_ms}ms` : ''}</span>
                    </div>

                    {/* ISP / ASN */}
                    {hasGeo && (
                      <div className="text-[11px] text-on-surface-variant font-code-sm mt-1 truncate">
                        {hop.geo!.asn} · {hop.geo!.isp}
                      </div>
                    )}

                    {/* Geolocation detail panel for selected hop */}
                    {isSelected && hasGeo && (
                      <div className="mt-2 pt-2 border-t border-outline-variant/15 flex flex-col gap-1">
                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                          <span className="text-outline uppercase tracking-wider">Source IP</span>
                          <span className="font-mono text-primary font-bold">{hop.ip}</span>
                          <span className="text-outline uppercase tracking-wider">Location</span>
                          <span className="text-on-surface">Approx: {hop.geo!.city}, {hop.geo!.region}, {hop.geo!.country}</span>
                          <span className="text-outline uppercase tracking-wider">ISP</span>
                          <span className="text-on-surface truncate">{hop.geo!.isp}</span>
                          <span className="text-outline uppercase tracking-wider">ASN</span>
                          <span className="text-on-surface font-mono">{hop.geo!.asn}</span>
                          <span className="text-outline uppercase tracking-wider">Org</span>
                          <span className="text-on-surface truncate">{hop.geo!.org}</span>
                          <span className="text-outline uppercase tracking-wider">Timezone</span>
                          <span className="text-on-surface">{hop.geo!.timezone}</span>
                          <span className="text-outline uppercase tracking-wider">Confidence</span>
                          <span className="text-tertiary">Approximate / Provider reported</span>
                        </div>
                      </div>
                    )}

                    {/* Location unavailable notice */}
                    {!hasGeo && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-outline-variant">
                        <span className="material-symbols-outlined text-[12px]">location_off</span>
                        <span>Location unavailable — geolocation provider did not return valid coordinates.</span>
                      </div>
                    )}

                    {hop.is_anomalous && hasGeo && (
                      <div className="mt-2 p-1.5 rounded bg-error-container/30 border border-error/40 text-error flex items-center gap-1.5 text-[10px] font-semibold">
                        <span className="material-symbols-outlined text-xs">warning</span>
                        <span>Country mismatch: infrastructure location does not match expected sender region</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
