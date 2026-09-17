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
  const [resolvedCount, setResolvedCount] = useState(0);

  const loadData = async () => {
    setIsLoading(true);
    const caseId = getUserCaseId();
    const [c, hList] = await Promise.all([fetchCurrentCase(caseId), fetchRouteHops(caseId)]);
    setCaseData(c);

    if (hList.length === 0) {
      setHops([]);
      setIsLoading(false);
      return;
    }

    const geoMap = new Map<string, IPGeolocationRecord>();
    let resolved = 0;
    const uniqueIPs = Array.from(new Set(hList.map((h) => h.ip).filter(Boolean)));

    await Promise.all(
      uniqueIPs.map(async (ip) => {
        try {
          const res = await fetch(`/api/geolocation/${encodeURIComponent(ip)}`);
          if (!res.ok) return;
          const json = await res.json();
          if (json.success && json.data) {
            geoMap.set(ip, json.data as IPGeolocationRecord);
            resolved++;
          }
        } catch {}
      })
    );

    setResolvedCount(resolved);
    const enriched = hList.map((h) => ({ ...h, geo: geoMap.get(h.ip) ?? undefined }));
    setHops(enriched);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('aegis-case-updated', loadData);
    return () => window.removeEventListener('aegis-case-updated', loadData);
  }, []);

  const isAnalyzed = caseData?.status !== 'standby' && hops.length > 0;
  const sourceIP = hops[0]?.ip;

  return (
    <div className="flex flex-col w-full pb-space-xl">
      <div className="w-full flex flex-wrap items-center justify-between py-space-sm mb-space-md bg-surface-container-low rounded-lg px-space-lg shadow-sm border border-outline-variant/15">
        <div className="flex flex-wrap items-center gap-space-lg">
          <div className="flex items-center gap-space-xs">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">CASE</span>
            <span className="font-code-md text-code-md text-primary font-semibold">{caseData?.id || '—'}</span>
          </div>
          <span className="text-outline-variant select-none hidden sm:inline">•</span>
          <div className="flex items-center gap-space-xs">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">STAGE 4</span>
            <span className="font-code-md text-code-md text-on-surface">Infrastructure Geolocation</span>
          </div>
          {sourceIP && isAnalyzed && (
            <>
              <span className="text-outline-variant select-none hidden sm:inline">•</span>
              <div className="flex items-center gap-space-xs">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">SOURCE IP</span>
                <span className="font-mono text-xs font-bold text-error bg-error/10 px-2 py-0.5 rounded border border-error/20">{sourceIP}</span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-space-md mt-2 sm:mt-0">
          {isAnalyzed && (
            <div className="flex items-center gap-space-xs px-space-sm py-0.5 rounded bg-error/10 font-code-sm text-code-sm text-error border border-error/20">
              <span className="h-1.5 w-1.5 rounded-full bg-error animate-ping" />
              <span className="font-semibold">{resolvedCount}/{hops.length} Hops Geo-Resolved</span>
            </div>
          )}
          <Link href="/final-forensic-report" className="px-space-md py-1 rounded bg-primary text-on-primary font-body-sm text-xs font-bold hover:bg-primary-container transition-all flex items-center gap-1 shadow-sm">
            <span>Generate Final Report →</span>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="w-full h-96 flex flex-col items-center justify-center gap-3 bg-surface-container-lowest rounded-xl border border-outline-variant/20 font-code-sm text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-3xl text-primary">sync</span>
          <span>Resolving IP geolocation from email headers…</span>
          <span className="text-xs text-outline">Querying ipinfo.io for live coordinates · no cached or hardcoded locations</span>
        </div>
      ) : hops.length === 0 ? (
        <div className="bg-surface-container rounded-2xl p-8 border border-outline-variant/20 shadow-md flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-tertiary/10 text-tertiary flex items-center justify-center mb-4 border border-tertiary/20">
            <span className="material-symbols-outlined text-3xl">location_off</span>
          </div>
          <h2 className="font-headline-sm text-xl font-bold text-on-surface">No Public IPs Found in Email Headers</h2>
          <p className="text-sm text-on-surface-variant max-w-lg mt-1 mb-6">
            Upload an <code className="text-primary font-mono font-bold">.EML</code> file with <code className="text-tertiary font-mono">Received:</code> headers containing public IP addresses to trace the routing path.
          </p>
          <EmlIngestionDropzone onAnalyzed={() => loadData()} className="w-full max-w-2xl text-left" />
        </div>
      ) : (
        <GeoGlobeMap hops={hops} />
      )}
    </div>
  );
}