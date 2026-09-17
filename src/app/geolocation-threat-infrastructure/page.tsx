'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { GeoGlobeMap } from '@/components/maps/GeoGlobeMap';
import { fetchRouteHops, fetchCurrentCase } from '@/lib/services/cases';
import { RouteHop, CaseRecord, IPGeolocationRecord } from '@/lib/supabase/types';
import { EmlIngestionDropzone } from '@/components/evidence/EmlIngestionDropzone';
import { getUserCaseId } from '@/lib/auth';

export default function GeolocationPage() {
  const [caseData, setCaseData] = useState<CaseRecord | null>(null);
  const [hops, setHops] = useState<RouteHop[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    const caseId = getUserCaseId();
    const c = await fetchCurrentCase(caseId);
    const hList = await fetchRouteHops(caseId);
    setCaseData(c);

    if (hList.length === 0) {
      setHops([]);
      setIsLoading(false);
      return;
    }

    // Call batch geolocation API to resolve coordinates if needed
    try {
      const ips = hList.map((h) => h.ip);
      const res = await fetch('/api/geolocate/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ips }),
      });

      if (res.ok) {
        const batchData = await res.json();
        if (batchData.records && Array.isArray(batchData.records)) {
          const geoMap = new Map<string, IPGeolocationRecord>();
          batchData.records.forEach((r: IPGeolocationRecord) => {
            geoMap.set(r.ip, r);
          });

          const enriched = hList.map((h) => ({
            ...h,
            geo: geoMap.get(h.ip) || h.geo,
          }));
          setHops(enriched);
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Batch geolocation lookup notice:', err);
    }

    setHops(hList);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('aegis-case-updated', loadData);
    return () => window.removeEventListener('aegis-case-updated', loadData);
  }, []);

  const isAnalyzed = caseData?.status !== 'standby' && hops.length > 0;

  return (
    <div className="flex flex-col w-full pb-space-xl">
      {/* Case Context Meta Strip */}
      <div className="w-full flex flex-wrap items-center justify-between py-space-sm mb-space-md bg-surface-container-low rounded-lg px-space-lg shadow-sm border border-outline-variant/15">
        <div className="flex flex-wrap items-center gap-space-lg">
          <div className="flex items-center gap-space-xs">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">
              CASE
            </span>
            <span className="font-code-md text-code-md text-primary font-semibold">
              {caseData?.id || 'CASE-2026-00124'}
            </span>
          </div>
          <span className="text-outline-variant select-none hidden sm:inline">•</span>
          <div className="flex items-center gap-space-xs">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">
              STAGE 4
            </span>
            <span className="font-code-md text-code-md text-on-surface">
              Attacker Location &amp; Routing
            </span>
          </div>
        </div>

        <div className="flex items-center gap-space-md mt-2 sm:mt-0">
          {isAnalyzed && (
            <div className="flex items-center gap-space-xs px-space-sm py-0.5 rounded bg-error/10 font-code-sm text-code-sm text-error border border-error/20">
              <span className="h-1.5 w-1.5 rounded-full bg-error animate-ping" />
              <span className="font-semibold">{hops.length} Hops Extracted</span>
            </div>
          )}
          <Link
            href="/final-forensic-report"
            className="px-space-md py-1 rounded bg-primary text-on-primary font-body-sm text-xs font-bold hover:bg-primary-container transition-all flex items-center gap-1 shadow-sm"
          >
            <span>Generate Final Report →</span>
          </Link>
        </div>
      </div>

      {/* Main Mapbox / MapLibre 3D Globe & Infrastructure Grid */}
      {isLoading ? (
        <div className="w-full h-96 flex items-center justify-center bg-surface-container-lowest rounded-xl border border-outline-variant/20 font-code-sm text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin mr-2">sync</span>
          Resolving Server-Side IP Geolocation Telemetry...
        </div>
      ) : hops.length === 0 ? (
        <div className="bg-surface-container rounded-2xl p-8 border border-outline-variant/20 shadow-md flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-tertiary/10 text-tertiary flex items-center justify-center mb-4 border border-tertiary/20">
            <span className="material-symbols-outlined text-3xl">public</span>
          </div>
          <h2 className="font-headline-sm text-xl font-bold text-on-surface">
            Geolocation Hop Tracer Standby
          </h2>
          <p className="text-sm text-on-surface-variant max-w-lg mt-1 mb-6">
            Upload an <code className="text-primary font-mono font-bold">.EML</code> file to extract all <code className="text-tertiary font-mono">Received:</code> server hops and trace international route origins on the interactive 3D globe.
          </p>

          <EmlIngestionDropzone onAnalyzed={() => loadData()} className="w-full max-w-2xl text-left" />
        </div>
      ) : (
        <GeoGlobeMap hops={hops} />
      )}
    </div>
  );
}
