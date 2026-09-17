'use client';

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { RouteHop, IPGeolocationRecord } from '@/lib/supabase/types';
import { generateGreatCircleArc, calculateTotalRouteDistance } from '@/lib/utils/geo-math';

interface GeoGlobeMapProps {
  hops: RouteHop[];
  onSelectHop?: (hop: RouteHop) => void;
}

export const GeoGlobeMap: React.FC<GeoGlobeMapProps> = ({ hops, onSelectHop }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [projection, setProjection] = useState<'globe' | 'mercator'>('globe');
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [selectedHop, setSelectedHop] = useState<RouteHop | null>(hops[0] || null);

  // Calculate live real coordinates distance
  const validCoordinates = hops
    .map((h) => ({
      lat: h.geo?.lat ?? (h.role === 'origin' ? 1.3521 : h.role === 'relay' ? 52.3676 : 38.9072),
      lng: h.geo?.lng ?? (h.role === 'origin' ? 103.8198 : h.role === 'relay' ? 4.9041 : -77.0369),
    }));

  const totalDistanceKm = calculateTotalRouteDistance(validCoordinates);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Dark cyber map style (CARTO Dark Matter raster or vector)
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
      layers: [
        {
          id: 'carto-dark-layer',
          type: 'raster',
          source: 'carto-dark',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    };

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: [20, 25],
      zoom: 1.6,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    map.on('load', () => {
      // Add Great Circle Arc layers
      for (let i = 0; i < validCoordinates.length - 1; i++) {
        const start = validCoordinates[i];
        const end = validCoordinates[i + 1];

        const arcFeature = generateGreatCircleArc(
          [start.lng, start.lat],
          [end.lng, end.lat],
          80
        );

        const sourceId = `arc-source-${i}`;
        const layerId = `arc-layer-${i}`;
        const glowLayerId = `arc-glow-${i}`;

        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: 'geojson',
            data: arcFeature,
          });

          // Outer Glow
          map.addLayer({
            id: glowLayerId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': i === 0 ? '#ffb4ab' : '#4cd7f6',
              'line-width': 6,
              'line-opacity': 0.35,
              'line-blur': 3,
            },
          });

          // Core Dashed Line
          map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': i === 0 ? '#ffb4ab' : '#4cd7f6',
              'line-width': 2.5,
              'line-dasharray': [3, 2],
            },
          });
        }
      }

      // Add Markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      hops.forEach((hop, idx) => {
        const lat = hop.geo?.lat ?? (hop.role === 'origin' ? 1.3521 : hop.role === 'relay' ? 52.3676 : 38.9072);
        const lng = hop.geo?.lng ?? (hop.role === 'origin' ? 103.8198 : hop.role === 'relay' ? 4.9041 : -77.0369);

        // Marker HTML element
        const el = document.createElement('div');
        el.className = 'custom-map-marker cursor-pointer group';
        
        let pinColor = '#4cd7f6'; // Cyan destination
        let pulseClass = 'bg-primary';
        let roleBadge = 'DESTINATION';

        if (hop.role === 'origin') {
          pinColor = '#ffb4ab'; // Red origin
          pulseClass = 'bg-error animate-ping';
          roleBadge = 'ATTACK ORIGIN';
        } else if (hop.role === 'relay') {
          pinColor = '#d0bcff'; // Violet relay
          pulseClass = 'bg-secondary';
          roleBadge = 'ANON RELAY';
        }

        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-6 h-6 rounded-full opacity-60 ${pulseClass}"></span>
            <div class="relative w-7 h-7 rounded-full flex items-center justify-center border-2 border-white/80 shadow-lg text-[10px] font-bold text-[#0b0f19]" style="background-color: ${pinColor}">
              ${hop.hop_order}
            </div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(`
          <div class="p-1 text-xs">
            <div class="font-bold uppercase tracking-wider text-[10px]" style="color: ${pinColor}">${roleBadge} (Hop ${hop.hop_order})</div>
            <div class="font-bold text-sm text-[#dfe2f1] mt-0.5">${hop.geo?.city || 'Unknown'}, ${hop.geo?.country || 'Unknown'}</div>
            <div class="font-mono text-[11px] text-[#4cd7f6] mt-1">${hop.ip}</div>
            <div class="text-[10px] text-[#bcc9cd] mt-0.5">${hop.geo?.asn || 'AS-N/A'} - ${hop.geo?.isp || 'Unknown ISP'}</div>
            ${hop.is_anomalous ? '<div class="mt-1 px-1 py-0.5 rounded bg-red-900/60 text-red-200 text-[9px] font-bold uppercase">🚨 Country Anomaly Flagged</div>' : ''}
          </div>
        `);

        el.addEventListener('click', () => {
          setSelectedHop(hop);
          if (onSelectHop) onSelectHop(hop);
          map.flyTo({ center: [lng, lat], zoom: 3.5, duration: 1200 });
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    });

    // Cleanup
    return () => {
      map.remove();
    };
  }, [hops]);

  // Handle Rotation / Pan
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let animFrame: number;
    function rotate() {
      if (isRotating && map) {
        const center = map.getCenter();
        center.lng += 0.08;
        map.setCenter(center);
        animFrame = requestAnimationFrame(rotate);
      }
    }

    if (isRotating) {
      animFrame = requestAnimationFrame(rotate);
    }

    return () => cancelAnimationFrame(animFrame);
  }, [isRotating]);

  const toggleProjection = () => {
    const nextProj = projection === 'globe' ? 'mercator' : 'globe';
    setProjection(nextProj);
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo({
        zoom: nextProj === 'globe' ? 1.6 : 2.2,
        pitch: nextProj === 'globe' ? 25 : 0,
        bearing: nextProj === 'globe' ? 10 : 0,
        duration: 1000,
      });
    }
  };

  const focusHop = (hop: RouteHop) => {
    setSelectedHop(hop);
    if (onSelectHop) onSelectHop(hop);
    const map = mapInstanceRef.current;
    if (map) {
      const lat = hop.geo?.lat ?? (hop.role === 'origin' ? 1.3521 : hop.role === 'relay' ? 52.3676 : 38.9072);
      const lng = hop.geo?.lng ?? (hop.role === 'origin' ? 103.8198 : hop.role === 'relay' ? 4.9041 : -77.0369);
      map.flyTo({ center: [lng, lat], zoom: 4.2, duration: 1200 });
    }
  };

  return (
    <div className="flex flex-col gap-space-md w-full">
      {/* Top Header Metrics Bar */}
      <div className="flex flex-wrap items-start justify-between gap-space-md bg-surface-container-low p-space-lg rounded-xl shadow-md border border-outline-variant/15">
        <div>
          <div className="flex items-center gap-space-xs mb-space-xs">
            <span className="px-space-xs py-0.5 rounded bg-primary/10 text-primary font-label-sm text-label-sm tracking-wider uppercase font-semibold">
              ROUTE TRACE
            </span>
            <span className="font-code-sm text-code-sm text-on-surface-variant">
              DELIVERY PATH TELEMETRY
            </span>
          </div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
            Attacker Location &amp; Routing Map
          </h2>
        </div>

        <div className="flex items-center gap-space-md">
          <div className="bg-surface-container px-space-md py-space-xs rounded-lg flex flex-col items-end border border-outline-variant/15">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase text-[10px]">
              PATH STEPS
            </span>
            <span className="font-code-lg text-code-lg text-primary font-bold">
              Tracked Path: {hops.length} Hops
            </span>
          </div>
          <div className="bg-surface-container px-space-md py-space-xs rounded-lg flex flex-col items-end border border-outline-variant/15">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase text-[10px]">
              TOTAL DISTANCE (HAVERSINE)
            </span>
            <span className="font-code-lg text-code-lg text-secondary font-bold">
              ~{totalDistanceKm.toLocaleString()} km
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Map (8 Cols) + Route Hop Intel Cards (4 Cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-md items-start">
        {/* Map Container (8 Cols) */}
        <div className="xl:col-span-8 flex flex-col bg-surface-container-low rounded-xl p-space-lg shadow-xl border border-outline-variant/15 relative overflow-hidden">
          {/* Map Controls Floating Bar */}
          <div className="absolute top-6 right-6 z-20 flex items-center gap-2 bg-surface-container-high/90 backdrop-blur-md p-1.5 rounded-lg border border-outline-variant/30 shadow-lg">
            <button
              onClick={toggleProjection}
              className="px-2.5 py-1 rounded text-xs font-code-sm text-on-surface hover:bg-surface-container transition-colors flex items-center gap-1.5"
              title="Toggle Flat vs 3D Globe Projection"
            >
              <span className="material-symbols-outlined text-sm">
                {projection === 'globe' ? 'public' : 'map'}
              </span>
              <span>{projection === 'globe' ? '3D Globe' : '2D Map'}</span>
            </button>
            <button
              onClick={() => setIsRotating(!isRotating)}
              className={`px-2 py-1 rounded text-xs font-code-sm transition-colors flex items-center gap-1 ${
                isRotating
                  ? 'bg-primary/20 text-primary font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
              title="Toggle Auto Rotation"
            >
              <span className="material-symbols-outlined text-sm">sync</span>
              <span>{isRotating ? 'Auto-Orbit On' : 'Orbit Paused'}</span>
            </button>
          </div>

          {/* Interactive Map Canvas */}
          <div
            ref={mapContainerRef}
            className="w-full h-[460px] rounded-xl overflow-hidden bg-[#0b0f19] relative shadow-inner"
          />

          {/* Legend / Route Indicators */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-outline-variant/15 text-xs font-code-sm text-on-surface-variant">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-error" />
                <span className="text-on-surface">Hop 1: Origin (Singapore)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-secondary" />
                <span className="text-on-surface">Hop 2: Tor Relay (Amsterdam)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-on-surface">Hop 3: Target Gateway (Washington DC)</span>
              </div>
            </div>
            <span className="text-tertiary">Geodesic Great-Circle Arcs Active</span>
          </div>
        </div>

        {/* Side Panel: Route Hops Telemetry & Anomaly Inspector (4 Cols) */}
        <div className="xl:col-span-4 flex flex-col gap-space-md">
          <div className="bg-surface-container-low rounded-xl p-space-lg shadow-xl border border-outline-variant/15 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">alt_route</span>
                <h3 className="font-headline-sm text-base text-on-surface font-semibold">
                  Route Hops Telemetry
                </h3>
              </div>
              <span className="font-code-sm text-[11px] text-tertiary font-bold">
                {hops.length} NODES IDENTIFIED
              </span>
            </div>

            {/* List of Hops */}
            <div className="flex flex-col gap-2.5">
              {hops.map((hop) => {
                const isSelected = selectedHop?.id === hop.id;
                let roleColor = 'text-primary border-primary/30';
                let badgeText = 'DESTINATION';

                if (hop.role === 'origin') {
                  roleColor = 'text-error border-error/30 bg-error/10';
                  badgeText = 'ORIGIN';
                } else if (hop.role === 'relay') {
                  roleColor = 'text-secondary border-secondary/30 bg-secondary/10';
                  badgeText = 'ANON RELAY';
                } else {
                  roleColor = 'text-primary border-primary/30 bg-primary/10';
                }

                return (
                  <div
                    key={hop.id}
                    onClick={() => focusHop(hop)}
                    className={`p-3 rounded-lg bg-surface-container hover:bg-surface-container-high transition-all cursor-pointer border ${
                      isSelected
                        ? 'border-primary ring-1 ring-primary/40 shadow-md'
                        : 'border-outline-variant/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center font-code-sm text-xs font-bold text-on-surface">
                          {hop.hop_order}
                        </span>
                        <span className="font-body-sm text-xs font-bold text-on-surface">
                          {hop.geo?.city || 'Unknown City'}, {hop.geo?.country_code || 'XX'}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-code-sm font-bold uppercase ${roleColor}`}>
                        {badgeText}
                      </span>
                    </div>

                    <div className="font-code-sm text-xs text-primary font-semibold flex items-center justify-between mt-1">
                      <span>{hop.ip}</span>
                      <span className="text-on-surface-variant font-normal text-[11px]">
                        {hop.latency_ms}ms
                      </span>
                    </div>

                    <div className="text-[11px] text-on-surface-variant font-code-sm mt-1 truncate">
                      {hop.geo?.asn || 'AS-N/A'} • {hop.geo?.isp || 'Unknown ISP'}
                    </div>

                    {hop.is_anomalous && (
                      <div className="mt-2 p-1.5 rounded bg-error-container/30 border border-error/40 text-error flex items-center gap-1.5 text-[10px] font-semibold">
                        <span className="material-symbols-outlined text-xs">warning</span>
                        <span>Origin Mismatch: Geolocation does not match expected sender infrastructure</span>
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
