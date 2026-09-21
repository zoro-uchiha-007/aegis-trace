'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RiskGauge } from '@/components/forensics/RiskGauge';
import { EvidenceUploadModal } from '@/components/evidence/EvidenceUploadModal';
import { EmlIngestionDropzone } from '@/components/evidence/EmlIngestionDropzone';
import { GmailInboxPanel } from '@/components/evidence/GmailInboxPanel';
import { 
  fetchCurrentCase, 
  fetchCaseFindings, 
  updateCaseStatus, 
  resetCaseToStandby 
} from '@/lib/services/cases';
import { CaseRecord, CaseFindings } from '@/lib/supabase/types';
import { getUserCaseId } from '@/lib/auth';

export default function Stage1FastTriagePage() {
  const router = useRouter();
  const [caseData, setCaseData] = useState<CaseRecord | null>(null);
  const [findings, setFindings] = useState<CaseFindings | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const loadData = async () => {
    const caseId = getUserCaseId();
    const c = await fetchCurrentCase(caseId);
    const fList = await fetchCaseFindings(caseId);
    setCaseData(c);
    const stage1Findings = fList.find((f) => f.stage === 1) || fList[0];
    setFindings(stage1Findings || null);
  };

  useEffect(() => {
    loadData();

    const handleCaseUpdate = () => {
      loadData();
    };
    window.addEventListener('aegis-case-updated', handleCaseUpdate);
    return () => window.removeEventListener('aegis-case-updated', handleCaseUpdate);
  }, []);

  const handleProceedToStage2 = async () => {
    setIsTransitioning(true);
    await updateCaseStatus(
      getUserCaseId(),
      'deep_forensics',
      'Triage confirmed: High priority multi-vector attack. Escalated to Stage 2 Deep Forensics.'
    );
    setTimeout(() => {
      router.push('/stage-2-deep-forensics');
    }, 450);
  };

  const handleReset = () => {
    resetCaseToStandby(getUserCaseId());
    loadData();
  };

  const isAnalyzed = caseData?.status !== 'standby' && findings !== null;
  const details = findings?.details || {};
  const riskScore = findings?.risk_score ?? caseData?.risk_score ?? 0;

  return (
    <div className="flex flex-col w-full pb-12">
      {/* Top Forensic Breadcrumb & Session Bar */}
      <div className="flex flex-wrap items-center justify-between gap-space-md py-space-md mb-space-lg bg-surface-container-low px-space-xl rounded-xl shadow-sm border border-outline-variant/15">
        <div className="flex items-center gap-space-md">
          <div className="flex items-center gap-space-xs text-primary">
            <span className="material-symbols-outlined text-sm">bolt</span>
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">
              Fast Triage
            </span>
          </div>
          <span className="text-outline text-xs">/</span>
          <span className="font-body-sm text-body-sm text-on-surface font-medium font-mono">
            Case #{caseData?.id || 'CASE-2026-00124'}
          </span>
          <span className="text-outline text-xs">•</span>
          <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold uppercase ${
            isAnalyzed ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'
          }`}>
            {isAnalyzed ? 'Telemetry Ingested' : 'Standby / Awaiting Ingestion'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {isAnalyzed && (
            <button
              onClick={handleReset}
              className="px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/20 font-code-sm text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">restart_alt</span>
              <span>Reset Case</span>
            </button>
          )}
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-3 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-code-sm text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">upload_file</span>
            <span>Upload Email Artifact (.eml)</span>
          </button>
          {isAnalyzed && (
            <div className={`flex items-center gap-space-xs px-space-sm py-0.5 rounded font-label-sm text-label-sm font-semibold border ${
              riskScore > 70 ? 'bg-error-container/30 text-error border-error/20' : 'bg-tertiary/10 text-tertiary border-tertiary/20'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full animate-ping ${riskScore > 70 ? 'bg-error' : 'bg-tertiary'}`} />
              <span>{riskScore > 70 ? 'Active High Priority Threat' : 'Analysis Complete'}</span>
            </div>
          )}
        </div>
      </div>

      {/* If Standby / Unanalyzed: Show Ingestion Options */}
      {!isAnalyzed ? (
        <div className="flex flex-col gap-6">
          {/* Page heading */}
          <div className="flex items-center gap-4 px-1">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 flex-shrink-0">
              <span className="material-symbols-outlined text-2xl">bolt</span>
            </div>
            <div>
              <h2 className="font-headline-sm text-xl font-bold text-on-surface">
                Stage 1: Fast Email Authentication &amp; Multi-Vector Triage
              </h2>
              <p className="text-sm text-on-surface-variant mt-0.5">
                Upload <code className="text-primary font-mono font-bold">.EML</code> files manually, or connect Gmail to analyze inbox emails live without any export.
              </p>
            </div>
          </div>

          {/* Two-column layout: EML upload | Gmail inbox */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Left: EML Multi-file Dropzone */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <span className="material-symbols-outlined text-primary text-sm">upload_file</span>
                <span className="text-xs font-bold text-on-surface uppercase tracking-wider font-code-sm">Upload .EML Files</span>
              </div>
              <EmlIngestionDropzone onAnalyzed={() => loadData()} className="w-full" />
            </div>

            {/* Right: Gmail Live Inbox */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <span className="material-symbols-outlined text-tertiary text-sm">inbox</span>
                <span className="text-xs font-bold text-on-surface uppercase tracking-wider font-code-sm">Gmail Live Inbox</span>
                <span className="px-1.5 py-0.5 rounded bg-tertiary/10 text-tertiary border border-tertiary/20 text-[10px] font-bold font-mono">LIVE</span>
              </div>
              <GmailInboxPanel onEmailAnalyzed={() => loadData()} />
            </div>
          </div>
        </div>
      ) : (
        /* Primary Asymmetric 3-Card Forensic Canvas when Analyzed */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-xl items-start">
          {/* CARD 1: Email Authentication & Protocol Verdict (Col-Span 4) */}
          <div className="xl:col-span-4 flex flex-col bg-surface-container rounded-xl p-space-xl shadow-md space-y-space-lg border border-outline-variant/20">
            <div className="flex items-center justify-between pb-space-sm border-b border-outline-variant/15">
              <div className="flex items-center gap-space-sm">
                <div className="p-space-xs rounded bg-surface-container-high text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-base">mark_email_read</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm text-primary uppercase tracking-widest leading-tight font-semibold">
                    Verification
                  </span>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface leading-tight font-bold">
                    Email Security Checks
                  </h2>
                </div>
              </div>
              <span className={`px-space-xs py-0.5 rounded font-label-sm text-label-sm uppercase font-bold ${
                details.dmarc_status === 'Passed' ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-error-container text-on-error-container'
              }`}>
                {details.dmarc_status === 'Passed' ? 'All Passed' : 'Issues Found'}
              </span>
            </div>

            <div className="flex flex-col gap-space-md">
              {/* SPF Check */}
              <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col gap-space-xs border border-outline-variant/15">
                <div className="flex items-center justify-between">
                  <span className="font-body-md text-body-md font-semibold text-on-surface">
                    Sender Verification (SPF)
                  </span>
                  <span className={`px-space-xs py-0.5 rounded font-label-sm text-label-sm font-semibold border ${
                    details.spf_status === 'Passed' ? 'bg-tertiary/10 text-tertiary border-tertiary/30' : 'bg-error-container/30 text-error border-error/30'
                  }`}>
                    {details.spf_status || 'Failed'}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  {details.spf_reason || 'Sender IP is not authorized in published SPF policy.'}
                </p>
              </div>

              {/* DKIM Check */}
              <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col gap-space-xs border border-outline-variant/15">
                <div className="flex items-center justify-between">
                  <span className="font-body-md text-body-md font-semibold text-on-surface">
                    Signature Check (DKIM)
                  </span>
                  <span className={`px-space-xs py-0.5 rounded font-label-sm text-label-sm font-semibold border ${
                    details.dkim_status === 'Passed' ? 'bg-tertiary/10 text-tertiary border-tertiary/20' : 'bg-error-container/30 text-error border-error/30'
                  }`}>
                    {details.dkim_status || 'Passed'}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  {details.dkim_reason || 'Digital signature is valid cryptographic stamp.'}
                </p>
              </div>

              {/* DMARC Check */}
              <div className={`p-space-md rounded-lg flex flex-col gap-space-xs border ${
                details.dmarc_status === 'Passed' ? 'bg-tertiary/10 border-tertiary/30' : 'bg-error-container/20 border-error/30'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-body-md text-body-md font-semibold text-on-surface">
                    Domain Policy (DMARC)
                  </span>
                  <span className={`px-space-xs py-0.5 rounded font-label-sm text-label-sm font-bold ${
                    details.dmarc_status === 'Passed' ? 'bg-tertiary text-on-tertiary' : 'bg-error text-on-error'
                  }`}>
                    {details.dmarc_status || 'Critical Failure'}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  {details.dmarc_reason || 'Sender domain does not match email envelope origin.'}
                </p>
              </div>
            </div>
          </div>

          {/* CARD 2: Multi-Vector Threat Signals (Col-Span 5) */}
          <div className="xl:col-span-5 flex flex-col bg-surface-container rounded-xl p-space-xl shadow-md space-y-space-lg border border-outline-variant/20">
            <div className="flex items-center justify-between pb-space-sm border-b border-outline-variant/15">
              <div className="flex items-center gap-space-sm">
                <div className="p-space-xs rounded bg-surface-container-high text-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-base">psychology</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest leading-tight font-semibold">
                    Analysis
                  </span>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface leading-tight font-bold">
                    Threat Detection
                  </h2>
                </div>
              </div>
              <span className="px-space-xs py-0.5 rounded bg-secondary-container text-on-secondary-container font-label-sm text-label-sm uppercase font-mono font-bold">
                AI Evaluated
              </span>
            </div>

            {/* Email Scan Risk */}
            <div className="p-space-lg rounded-lg bg-surface-container-low flex flex-col gap-space-sm border border-outline-variant/15">
              <div className="flex items-center justify-between">
                <span className={`font-headline-sm text-headline-sm font-bold ${
                  (details.phishing_risk_pct || 0) > 60 ? 'text-error' : 'text-tertiary'
                }`}>
                  Email Scan: {details.phishing_risk_pct || riskScore}% Phishing Risk
                </span>
              </div>
              <div className="p-space-sm rounded bg-surface-container text-body-sm text-body-sm text-on-surface-variant space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-on-surface font-medium">Target:</span>
                  <span className="text-primary font-medium">{caseData?.target_entity || 'Target Organization'}</span>
                </div>
                {details.attempted_wire_usd ? (
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface font-medium">Attempted Wire:</span>
                    <span className="text-error font-bold font-mono">
                      ${details.attempted_wire_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-on-surface font-medium">Sender Domain:</span>
                  <span className="text-error font-mono">{details.spoofed_domain || 'sender-domain.com'}</span>
                </div>
              </div>
            </div>

            {/* Voice Analysis Risk */}
            <div className="p-space-lg rounded-lg bg-surface-container-low flex flex-col gap-space-sm border border-outline-variant/15">
              <div className="flex items-center justify-between">
                <span className={`font-headline-sm text-headline-sm font-bold ${
                  details.deepfake_voice_pct ? 'text-secondary' : 'text-on-surface-variant'
                }`}>
                  Voice Analysis: {details.deepfake_voice_pct ? `${details.deepfake_voice_pct}% AI-Generated Voice` : 'No Audio Recording Attached'}
                </span>
                {!details.deepfake_voice_pct && (
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">mic</span>
                    <span>+ Add Audio</span>
                  </button>
                )}
              </div>
              {details.deepfake_voice_pct ? (
                <div className="h-9 w-full bg-surface-container rounded flex items-center px-space-md justify-between gap-1 overflow-hidden">
                  <span className="h-2 w-1 rounded-full bg-secondary/40" />
                  <span className="h-5 w-1 rounded-full bg-secondary" />
                  <span className="h-7 w-1 rounded-full bg-secondary" />
                  <span className="h-3 w-1 rounded-full bg-secondary/60" />
                  <span className="h-7 w-1 rounded-full bg-error" />
                  <span className="h-8 w-1 rounded-full bg-error animate-pulse" />
                  <span className="h-7 w-1 rounded-full bg-error" />
                  <span className="h-4 w-1 rounded-full bg-secondary" />
                  <span className="h-6 w-1 rounded-full bg-secondary" />
                  <span className="h-3 w-1 rounded-full bg-secondary/40" />
                  <span className="h-7 w-1 rounded-full bg-error" />
                  <span className="h-8 w-1 rounded-full bg-error animate-pulse" />
                  <span className="h-6 w-1 rounded-full bg-secondary" />
                  <span className="h-4 w-1 rounded-full bg-secondary/50" />
                  <span className="h-2 w-1 rounded-full bg-secondary/30" />
                  <span className="h-5 w-1 rounded-full bg-secondary" />
                  <span className="h-7 w-1 rounded-full bg-error" />
                  <span className="h-3 w-1 rounded-full bg-secondary/40" />
                </div>
              ) : (
                <div className="p-3 bg-surface-container rounded-lg text-xs text-on-surface-variant flex items-center gap-2">
                  <span className="material-symbols-outlined text-outline text-base">info</span>
                  <span>Email artifact only. No voicemail / audio call attached to this case.</span>
                </div>
              )}
            </div>

            <div className="p-space-sm rounded-lg bg-surface-container-high flex items-center gap-space-sm border border-outline-variant/15">
              <span className="material-symbols-outlined text-outline text-sm">info</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-tight">
                Requires security analyst confirmation before wire authorization quarantine.
              </p>
            </div>
          </div>

          {/* CARD 3: Initial Threat Assessment & Stage 2 Progression (Col-Span 3) */}
          <div className="xl:col-span-3 flex flex-col bg-surface-container rounded-xl p-space-xl shadow-md space-y-space-lg border border-outline-variant/20">
            <div className="flex items-center justify-between pb-space-sm border-b border-outline-variant/15">
              <div className="flex items-center gap-space-sm">
                <div className="p-space-xs rounded bg-surface-container-high text-error flex items-center justify-center">
                  <span className="material-symbols-outlined text-base">security</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm text-error uppercase tracking-widest leading-tight font-semibold">
                    Verdict
                  </span>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface leading-tight font-bold">
                    Risk Score
                  </h2>
                </div>
              </div>
              <span className={`font-code-sm text-code-sm font-bold ${
                riskScore > 70 ? 'text-error' : riskScore > 40 ? 'text-secondary' : 'text-tertiary'
              }`}>
                {riskScore > 70 ? 'High Risk' : riskScore > 40 ? 'Medium Risk' : 'Low Threat'}
              </span>
            </div>

            {/* Radial 0-100 Gauge */}
            <RiskGauge score={riskScore} label={riskScore > 70 ? 'HIGH THREAT' : riskScore > 40 ? 'SUSPICIOUS' : 'VERIFIED CLEAN'} />

            {/* Key Indicators */}
            <div className="flex flex-col gap-space-xs p-space-md rounded-lg bg-surface-container-low border border-outline-variant/15">
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-1 font-semibold">
                Key Indicators
              </span>
              {(details.key_indicators || [
                { name: 'Email Security', status: details.dmarc_status === 'Passed' ? 'Aligned' : 'Mismatch', severity: details.dmarc_status === 'Passed' ? 'tertiary' : 'error' },
                { name: 'Email Content', status: riskScore > 50 ? 'Scam Wording' : 'Normal', severity: riskScore > 50 ? 'error' : 'tertiary' },
                { name: 'Voice Clip', status: details.deepfake_voice_pct ? 'Cloned Voice' : 'Clean', severity: details.deepfake_voice_pct ? 'secondary' : 'tertiary' },
                { name: 'Link Inspection', status: details.spoofed_domain ? 'Fake Link' : 'Clean', severity: details.spoofed_domain ? 'error' : 'tertiary' },
              ]).map((indicator, idx) => (
                <div key={idx} className="flex items-center justify-between text-body-sm py-1 border-b border-outline-variant/10 last:border-0">
                  <span className="text-on-surface">{indicator.name}</span>
                  <span className={`font-semibold flex items-center gap-1 ${
                    indicator.severity === 'error' ? 'text-error' : indicator.severity === 'secondary' ? 'text-secondary' : 'text-tertiary'
                  }`}>
                    <span className="material-symbols-outlined text-xs">
                      {indicator.severity === 'error' ? 'cancel' : indicator.severity === 'secondary' ? 'graphic_eq' : 'check_circle'}
                    </span>
                    <span>{indicator.status}</span>
                  </span>
                </div>
              ))}
            </div>

            {/* Proceed to Stage 2 Action Button */}
            <div className="pt-space-xs flex flex-col gap-space-xs">
              <button
                onClick={handleProceedToStage2}
                disabled={isTransitioning}
                className="w-full bg-primary hover:bg-primary-fixed text-on-primary font-headline-sm text-headline-sm py-space-md px-space-lg rounded-xl flex items-center justify-center gap-space-sm font-bold shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98]"
                id="stage2-transition-btn"
              >
                <span>{isTransitioning ? 'Advancing Case State...' : 'Proceed to Detailed Analysis'}</span>
                <span className="material-symbols-outlined text-base font-bold">
                  {isTransitioning ? 'sync' : 'arrow_forward'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Ingestion Modal for Stage 1 */}
      <EvidenceUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        caseId="CASE-2026-00124"
        defaultTab="email"
        onUploadSuccess={() => loadData()}
      />
    </div>
  );
}
