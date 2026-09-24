'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  fetchCurrentCase, 
  fetchAuditLogs, 
  fetchRouteHops, 
  fetchCaseFindings, 
  resetCaseToStandby 
} from '@/lib/services/cases';
import { CaseRecord, AuditLogRecord, RouteHop, CaseFindings } from '@/lib/supabase/types';
import { EmlIngestionDropzone } from '@/components/evidence/EmlIngestionDropzone';
import { getUserCaseId } from '@/lib/auth';

export default function DashboardPage() {
  const [currentCase, setCurrentCase] = useState<CaseRecord | null>(null);
  const [findings, setFindings] = useState<CaseFindings[]>([]);
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [hops, setHops] = useState<RouteHop[]>([]);

  const loadData = async () => {
    const caseId = getUserCaseId();
    const [c, f, l, h] = await Promise.all([
      fetchCurrentCase(caseId),
      fetchCaseFindings(caseId),
      fetchAuditLogs(caseId),
      fetchRouteHops(caseId),
    ]);
    setCurrentCase(c);
    setFindings(f);
    setLogs(l);
    setHops(h);
  };

  useEffect(() => {
    loadData();

    // Listen for real-time case updates
    const handleCaseUpdate = () => {
      loadData();
    };
    window.addEventListener('aegis-case-updated', handleCaseUpdate);
    return () => window.removeEventListener('aegis-case-updated', handleCaseUpdate);
  }, []);

  const isAnalyzed = currentCase?.status !== 'standby' && findings.length > 0;
  const f1 = findings.find((f) => f.stage === 1) || findings[0];

  const handleReset = () => {
    const caseId = getUserCaseId();
    resetCaseToStandby(caseId);
    loadData();
  };

  return (
    <div className="flex flex-col w-full pb-space-xl gap-space-lg">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-space-md p-space-lg bg-surface-container-low rounded-xl shadow-md border border-outline-variant/15">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold uppercase ${
              isAnalyzed ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'
            }`}>
              {isAnalyzed ? 'SOC Active Investigation' : 'SOC Standby Operations'}
            </span>
            <span className="text-on-surface-variant text-xs">
              {isAnalyzed ? '• Live Multi-Modal Telemetry Stream' : '• System Ready for EML Ingestion'}
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold">
            AEGIS-TRACE Investigation Console
          </h1>
          <p className="font-body-md text-on-surface-variant text-sm">
            Autonomous multi-modal forensic analysis, RFC-822 email header extraction, and geopolitical route tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAnalyzed ? (
            <>
              <button
                onClick={handleReset}
                className="px-3 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-semibold text-xs transition-all border border-outline-variant/20 flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">restart_alt</span>
                <span>Reset to Standby</span>
              </button>
              <Link
                href="/stage-1-fast-triage"
                className="px-4 py-2 rounded-lg bg-primary text-on-primary font-semibold text-sm hover:bg-primary-container transition-all shadow-lg flex items-center gap-2"
              >
                <span>View Stage 1 Triage</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-tertiary/10 text-tertiary border border-tertiary/20 text-xs font-semibold">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>Telemetry Engine Idle</span>
            </div>
          )}
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        <div className="bg-surface-container rounded-xl p-4 shadow-sm border border-outline-variant/15 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-label-sm text-on-surface-variant uppercase text-xs font-semibold">
              Active Case
            </span>
            <span className="font-headline-sm text-lg font-bold text-primary mt-1 font-mono">
              {currentCase?.id || 'CASE-2026-00124'}
            </span>
            <span className="text-xs text-on-surface-variant mt-0.5">
              {isAnalyzed ? 'Under Active Analysis' : 'Awaiting Ingestion'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined">folder_open</span>
          </div>
        </div>

        <div className="bg-surface-container rounded-xl p-4 shadow-sm border border-outline-variant/15 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-label-sm text-on-surface-variant uppercase text-xs font-semibold">
              Risk Severity
            </span>
            <span className={`font-headline-sm text-lg font-bold mt-1 ${
              !isAnalyzed ? 'text-on-surface-variant' : currentCase?.risk_score && currentCase.risk_score > 70 ? 'text-error' : 'text-tertiary'
            }`}>
              {isAnalyzed ? `${currentCase?.risk_score} / 100` : '-- / 100'}
            </span>
            <span className="text-xs text-on-surface-variant mt-0.5">
              {isAnalyzed ? `${currentCase?.severity} Threat Level` : 'Unanalyzed'}
            </span>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isAnalyzed ? 'bg-error-container/30 text-error' : 'bg-surface-container-high text-outline'
          }`}>
            <span className="material-symbols-outlined">{isAnalyzed ? 'warning' : 'shield'}</span>
          </div>
        </div>

        <div className="bg-surface-container rounded-xl p-4 shadow-sm border border-outline-variant/15 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-label-sm text-on-surface-variant uppercase text-xs font-semibold">
              Phishing Scan Verdict
            </span>
            <span className="font-headline-sm text-lg font-bold text-secondary mt-1">
              {isAnalyzed ? `${f1?.details?.phishing_risk_pct || currentCase?.risk_score}% Risk` : 'Ready to Scan'}
            </span>
            <span className="text-xs text-on-surface-variant mt-0.5">
              {isAnalyzed ? (f1?.details?.spoofed_domain || 'Spoofed Domain Found') : 'Awaiting Header RFC-822'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined">mark_email_read</span>
          </div>
        </div>

        <div className="bg-surface-container rounded-xl p-4 shadow-sm border border-outline-variant/15 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-label-sm text-on-surface-variant uppercase text-xs font-semibold">
              Route Hops Tracked
            </span>
            <span className="font-headline-sm text-lg font-bold text-tertiary mt-1">
              {isAnalyzed ? `${hops.length} Geodesic Hops` : '0 Hops Tracked'}
            </span>
            <span className="text-xs text-on-surface-variant mt-0.5">
              {isAnalyzed && hops.length > 0 ? `${hops[0]?.geo?.city || 'Origin'} → Target` : 'Awaiting Ingestion'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-tertiary/10 flex items-center justify-center text-tertiary">
            <span className="material-symbols-outlined">public</span>
          </div>
        </div>
      </div>

      {/* Main Hero Ingestion Section if Standby */}
      {!isAnalyzed ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">upload_file</span>
              <h2 className="font-headline-sm text-base text-on-surface font-bold">
                Email Evidence Ingestion Portal
              </h2>
            </div>
            <span className="font-code-sm text-xs text-on-surface-variant">Step 1: Ingest .EML or select sample</span>
          </div>

          <EmlIngestionDropzone onAnalyzed={() => loadData()} />
        </div>
      ) : (
        /* Analyzed Quick Summary & Action Bar */
        <div className="p-space-lg bg-surface-container rounded-xl border border-primary/20 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-error-container/40 text-error flex items-center justify-center border border-error/30 shadow-inner">
              <span className="material-symbols-outlined text-2xl">security</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-base font-bold text-on-surface">
                  Analysis Active: {currentCase?.title}
                </span>
                <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container font-mono text-[11px] font-bold">
                  {currentCase?.risk_score}/100 Risk
                </span>
              </div>
              <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                Target: <strong className="text-primary">{currentCase?.target_entity}</strong> • SPF: <span className="text-error font-semibold">{f1?.details?.spf_status}</span> • DMARC: <span className="text-error font-semibold">{f1?.details?.dmarc_status}</span> • Hops: <strong className="text-tertiary">{hops.length} relays</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleReset}
              className="px-3 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant font-semibold text-xs transition-all border border-outline-variant/20 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              <span>Analyze Another .EML</span>
            </button>
            <Link
              href="/stage-1-fast-triage"
              className="px-4 py-2 rounded-lg bg-primary text-on-primary font-semibold text-xs hover:bg-primary-container transition-all shadow-md flex items-center gap-1.5"
            >
              <span>Explore Fast Triage →</span>
            </Link>
          </div>
        </div>
      )}

      {/* Stage Flow Navigation Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-headline-sm text-base text-on-surface font-bold">
            Investigation Workflow Stages
          </h2>
          <span className="font-code-sm text-xs text-on-surface-variant">Stitch UI 6-Stage Pipeline</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-space-md">
          {[
            {
              stage: 'Stage 1',
              title: 'Fast Triage',
              desc: 'SPF/DKIM/DMARC protocols, phishing & deepfake radial score.',
              href: '/stage-1-fast-triage',
              icon: 'bolt',
              color: 'text-primary border-primary/30',
            },
            {
              stage: 'Stage 2',
              title: 'Deep Forensics',
              desc: 'Pitch F0 acoustic analysis & payload YARA malware scanning.',
              href: '/stage-2-deep-forensics',
              icon: 'smb_share',
              color: 'text-primary border-primary/30',
            },
            {
              stage: 'Stage 3',
              title: 'Threat Graph',
              desc: 'Interactive node-link graph mapping attacker to CFO target.',
              href: '/threat-graph',
              icon: 'hub',
              color: 'text-secondary border-secondary/30',
            },
            {
              stage: 'Stage 4',
              title: 'Geolocation',
              desc: 'Geodesic map with offline Autonomous System fallback resiliency.',
              href: '/geolocation-threat-infrastructure',
              icon: 'public',
              color: 'text-tertiary border-tertiary/30',
            },
            {
              stage: 'Stage 5',
              title: 'Safety Intercept',
              desc: 'Greedy user click interception & isolated web quarantine sandbox.',
              href: '/safety-intervention',
              icon: 'gshield',
              color: 'text-error border-error/30',
            },
            {
              stage: 'Stage 6',
              title: 'Final Report',
              desc: 'Cryptographically sealed forensic incident report.',
              href: '/final-forensic-report',
              icon: 'description',
              color: 'text-on-surface-variant border-outline-variant/30',
            },
          ].map((s) => (
            <Link
              key={s.stage}
              href={s.href}
              className="p-space-md rounded-xl bg-surface-container hover:bg-surface-container-high transition-all border border-outline-variant/15 hover:border-primary/40 flex flex-col justify-between group shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-code-sm text-xs font-bold text-on-surface-variant uppercase">
                    {s.stage}
                  </span>
                  <div className={`p-1.5 rounded-lg bg-surface-container-low ${s.color}`}>
                    <span className="material-symbols-outlined text-base">{s.icon}</span>
                  </div>
                </div>
                <h3 className="font-headline-sm text-sm font-bold text-on-surface group-hover:text-primary transition-colors">
                  {s.title}
                </h3>
                <p className="font-body-sm text-xs text-on-surface-variant mt-1 line-clamp-2">
                  {s.desc}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-semibold text-primary">
                <span>{isAnalyzed ? 'Inspect Data' : 'Open Stage'}</span>
                <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Audit Log Stream */}
      <div className="bg-surface-container rounded-xl p-space-lg shadow-sm border border-outline-variant/15">
        <div className="flex items-center justify-between pb-space-sm border-b border-outline-variant/15 mb-space-md">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-base">receipt_long</span>
            <h2 className="font-headline-sm text-base text-on-surface font-bold">
              SOC Immutable Audit Log Stream
            </h2>
          </div>
          <span className="font-code-sm text-xs text-on-surface-variant font-mono">
            {logs.length} Events Logged
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {logs.slice(0, 5).map((log) => (
            <div
              key={log.id}
              className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between text-xs font-code-sm border border-outline-variant/10"
            >
              <div className="flex items-center gap-2">
                <span className="text-primary font-bold">{log.actor}:</span>
                <span className="text-on-surface font-medium">{log.action}</span>
              </div>
              <span className="text-on-surface-variant text-[11px]">
                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
