'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { WaveformVisualizer } from '@/components/forensics/WaveformVisualizer';
import { MalwareScanner } from '@/components/forensics/MalwareScanner';
import { EvidenceUploadModal } from '@/components/evidence/EvidenceUploadModal';
import { EmlIngestionDropzone } from '@/components/evidence/EmlIngestionDropzone';
import { fetchCurrentCase, fetchCaseFindings } from '@/lib/services/cases';
import { CaseRecord, CaseFindings } from '@/lib/supabase/types';
import { getUserCaseId } from '@/lib/auth';

export default function Stage2DeepForensicsPage() {
  const [caseData, setCaseData] = useState<CaseRecord | null>(null);
  const [findings, setFindings] = useState<CaseFindings | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTab, setUploadTab] = useState<'email' | 'voice'>('voice');

  const loadData = async () => {
    const caseId = getUserCaseId();
    const c = await fetchCurrentCase(caseId);
    const fList = await fetchCaseFindings(caseId);
    setCaseData(c);
    const stage2Findings = fList.find((f) => f.stage === 2) || fList[1] || fList[0];
    setFindings(stage2Findings || null);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('aegis-case-updated', loadData);
    return () => window.removeEventListener('aegis-case-updated', loadData);
  }, []);

  const openVoiceUpload = () => {
    setUploadTab('voice');
    setShowUploadModal(true);
  };

  const openEmailUpload = () => {
    setUploadTab('email');
    setShowUploadModal(true);
  };

  const isAnalyzed = caseData?.status !== 'standby' && findings !== null;
  const details = findings?.details || {};

  return (
    <div className="flex flex-col w-full pb-margin-desktop gap-space-xl">
      {/* 1. Header / Context Bar */}
      <section className="w-full bg-surface-container-low rounded-xl p-space-lg shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-space-md border border-outline-variant/15">
        <div className="flex flex-col sm:flex-row sm:items-center gap-space-lg">
          <div className="flex items-center gap-space-sm">
            <span className="p-space-xs rounded bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">smb_share</span>
            </span>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-semibold">
                Detailed Threat Analysis
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Stage 2: Deep Acoustic &amp; Payload Forensics
              </span>
            </div>
          </div>
          <div className="flex items-center gap-space-xs px-space-md py-1 rounded bg-surface-container font-code-sm text-code-sm text-on-surface border border-outline-variant/15">
            <span className="text-on-surface-variant font-label-sm uppercase tracking-wider">
              Target:
            </span>
            <span className="font-semibold text-primary">
              {caseData?.target_entity || 'Awaiting Ingestion'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-space-sm">
          <button
            onClick={openVoiceUpload}
            className="px-3 py-1.5 rounded-lg bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/30 font-code-sm text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">mic</span>
            <span>Upload New Audio (.wav/.mp3)</span>
          </button>
          <button
            onClick={openEmailUpload}
            className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-code-sm text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">upload_file</span>
            <span>Upload Attachment/EML</span>
          </button>
        </div>
      </section>

      {!isAnalyzed ? (
        <div className="bg-surface-container rounded-2xl p-8 border border-outline-variant/20 shadow-md flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center mb-4 border border-secondary/20">
            <span className="material-symbols-outlined text-3xl">smb_share</span>
          </div>
          <h2 className="font-headline-sm text-xl font-bold text-on-surface">
            Deep Forensics Standby
          </h2>
          <p className="text-sm text-on-surface-variant max-w-lg mt-1 mb-6">
            Upload an <code className="text-primary font-mono font-bold">.EML</code> file or audio recording to inspect decoded attachments, weaponized links, and neural voice synthesis spectrograms.
          </p>

          <EmlIngestionDropzone onAnalyzed={() => loadData()} className="w-full max-w-2xl text-left" />
        </div>
      ) : (
        <>
          {/* 2. Dual Deep Forensics Core (Acoustic + Extended Forensics Matrix) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-xl">
            {/* Left Column: Voice Forensics & Acoustic Deconstruction (7 Cols) */}
            <section className="xl:col-span-7 bg-surface-container-low rounded-xl p-space-xl shadow-md flex flex-col gap-space-lg border border-outline-variant/20">
              <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
                <div className="flex items-center gap-space-md">
                  <div className="flex flex-col">
                    <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      Voice Recording Analysis
                    </h2>
                    <span className="font-code-sm text-code-sm text-on-surface-variant">
                      Deepfake Audio Spectrum &amp; Artifact Inspection
                    </span>
                  </div>
                </div>
                {details.voice_similarity_pct ? (
                  <div className="flex items-center gap-space-xs px-space-sm py-1 rounded bg-error/10 text-error font-code-sm text-code-sm font-semibold animate-pulse border border-error/20">
                    <span className="material-symbols-outlined text-sm">record_voice_over</span>
                    <span>AI Voice Detected</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-space-xs px-space-sm py-1 rounded bg-surface-container font-code-sm text-code-sm text-on-surface-variant border border-outline-variant/15">
                    <span className="material-symbols-outlined text-sm">mic_off</span>
                    <span>No Audio Attached</span>
                  </div>
                )}
              </div>

              {details.voice_similarity_pct ? (
                <>
                  {/* Interactive Waveform Audio Visualizer */}
                  <WaveformVisualizer
                    duration={details.audio_duration_seconds || 32}
                    similarity={details.voice_similarity_pct || 94.1}
                    anomalyDetected={true}
                  />

                  {/* 3 Metric Diagnosis Enclaves */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
                    <div className="bg-surface-container p-space-md rounded-lg flex flex-col justify-between gap-space-xs border border-outline-variant/15">
                      <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                        Voice Similarity
                      </span>
                      <div className="font-headline-md text-headline-md text-on-surface font-bold">
                        {details.voice_similarity_pct}%
                      </div>
                      <span className="font-code-sm text-code-sm text-secondary">
                        Matches Executive Acoustic Print
                      </span>
                    </div>

                    <div className="bg-surface-container p-space-md rounded-lg flex flex-col justify-between gap-space-xs border border-outline-variant/15">
                      <span className="font-label-sm text-label-sm text-error uppercase tracking-wider font-semibold">
                        Speech Flow
                      </span>
                      <div className="font-headline-md text-headline-md text-error font-bold">
                        {details.speech_flow || 'Abnormal'}
                      </div>
                      <span className="font-code-sm text-code-sm text-error">
                        {details.speech_flow_detail || 'Unnatural Cadence (HiFi-GAN Synth)'}
                      </span>
                    </div>

                    <div className="bg-surface-container p-space-md rounded-lg flex flex-col justify-between gap-space-xs border border-outline-variant/15">
                      <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                        Intent
                      </span>
                      <div className="font-headline-sm text-headline-sm text-primary font-bold">
                        {details.intent || 'Urgent Wire'}
                      </div>
                      <span className="font-code-sm text-code-sm text-on-surface-variant">
                        {details.intent_detail || 'Fake Urgency to Bypass Approval'}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 px-6 rounded-xl bg-surface-container flex flex-col items-center justify-center text-center gap-4 border border-outline-variant/15">
                  <div className="w-14 h-14 rounded-2xl bg-surface-container-high flex items-center justify-center text-secondary border border-secondary/20">
                    <span className="material-symbols-outlined text-3xl">mic</span>
                  </div>
                  <div className="flex flex-col gap-1 max-w-md">
                    <h3 className="font-headline-sm text-base font-bold text-on-surface">
                      No Audio Recording Sample Ingested
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      This incident currently contains only email artifacts. Upload a voicemail recording (.wav, .mp3) to deconstruct acoustic harmonics and test for HiFi-GAN neural synthesis.
                    </p>
                  </div>
                  <button
                    onClick={openVoiceUpload}
                    className="px-4 py-2 rounded-lg bg-secondary text-on-secondary font-semibold text-xs transition-all flex items-center gap-1.5 shadow-md hover:bg-secondary-container hover:text-on-secondary-container"
                  >
                    <span className="material-symbols-outlined text-sm">upload_file</span>
                    <span>Upload Voicemail Audio (.wav/.mp3)</span>
                  </button>
                </div>
              )}
            </section>

            {/* Right Column: Multi-Vector Behavioral & Extended Forensics Matrix (5 Cols) */}
            <section className="xl:col-span-5 bg-surface-container-low rounded-xl p-space-xl shadow-md flex flex-col justify-between gap-space-lg border border-outline-variant/20">
              <div className="flex flex-col gap-space-xs pb-2 border-b border-outline-variant/15">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-error font-bold flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-error animate-ping" />
                    ACTIVE ATTACK PATH
                  </span>
                </div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Suspicious Email &amp; Attachment
                </h2>
                <span className="font-code-sm text-code-sm text-on-surface-variant">
                  Analysis of incoming message and weaponized links
                </span>
              </div>

              <div className="flex flex-col gap-space-md">
                {/* Fake Login Link with Safety Intercept */}
                <div className="bg-surface-container p-space-md rounded-lg flex flex-col gap-space-xs border border-outline-variant/15">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
                      Fake Login Link
                    </span>
                    <span className="px-space-xs py-0.5 rounded bg-error-container text-on-error-container font-label-sm font-bold">
                      Phishing
                    </span>
                  </div>
                  <div className="font-code-sm text-code-sm text-error font-semibold pt-1 break-all flex items-center justify-between gap-2">
                    <span>{details.phishing_url || 'https://corp-bi11ing-us.com/login?auth=cfo_wire'}</span>
                    <Link
                      href={`/safety-intervention?url=${encodeURIComponent(details.phishing_url || 'https://corp-bi11ing-us.com/login?auth=cfo_wire')}&reason=greedy_click_intercepted`}
                      className="px-2 py-0.5 rounded bg-error text-on-error font-bold text-[10px] hover:bg-error-container hover:text-on-error-container transition-all flex items-center gap-1 whitespace-nowrap shadow-sm"
                      title="Simulate user clicking flagged link - Triggers Safety Intervention"
                    >
                      <span className="material-symbols-outlined text-[12px]">security</span>
                      <span>Simulate Click</span>
                    </Link>
                  </div>
                  <div className="font-code-sm text-code-sm text-on-surface-variant mt-space-xs">
                    Leads to credential harvester designed to steal Active Directory executive session tokens. (Safety Intervention will intercept any click).
                  </div>
                </div>

                {/* Malicious Attachment */}
                <div className="bg-surface-container p-space-md rounded-lg flex flex-col gap-space-xs border border-outline-variant/15">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
                      Attachment Payload
                    </span>
                    <span className="px-space-xs py-0.5 rounded bg-error/20 text-error font-label-sm font-bold border border-error/30">
                      Exploit Detected
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-space-xs">
                      <span className="material-symbols-outlined text-error text-base">picture_as_pdf</span>
                      <span className="font-code-sm text-code-sm font-semibold text-on-surface">
                        {details.attachment_name || 'urgent_invoice.pdf'}
                      </span>
                    </div>
                    <span className="font-code-sm text-code-sm text-on-surface-variant">
                      {details.attachment_size || '98 KB'}
                    </span>
                  </div>
                  <div className="font-code-sm text-[10px] text-outline break-all mt-1">
                    SHA-256: {details.attachment_sha256 || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                  </div>
                </div>

                {/* Anonymized Origin */}
                <div className="bg-surface-container p-space-md rounded-lg flex flex-col gap-space-xs border border-outline-variant/15">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
                      Origin Infrastructure
                    </span>
                    <span className="px-space-xs py-0.5 rounded bg-surface-container-high text-primary font-label-sm font-semibold border border-primary/20">
                      ANONYMIZED
                    </span>
                  </div>
                  <div className="font-code-sm text-code-sm text-on-surface pt-1">
                    {details.anonymization || 'Hidden via Tor Exit Node & bulletproof relay (Amsterdam NL)'}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Deep Malware & Payload Sandbox Scanner */}
          <MalwareScanner />

          {/* 3. Forensic Progression Action Bar */}
          <section className="w-full bg-surface-container-low rounded-xl p-space-lg shadow-sm flex flex-col sm:flex-row items-center justify-between gap-space-md border border-outline-variant/15">
            <div className="flex items-center gap-space-md">
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Stage 2 Forensics Complete
              </span>
            </div>
            <div className="flex items-center gap-space-md w-full sm:w-auto">
              <Link
                href="/stage-1-fast-triage"
                className="w-full sm:w-auto px-space-md py-space-sm rounded-lg bg-surface-container text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm font-semibold transition-colors flex items-center justify-center gap-space-xs border border-outline-variant/20"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span>Back to Triage</span>
              </Link>
              <Link
                href="/threat-graph"
                className="w-full sm:w-auto px-space-xl py-space-sm rounded-lg bg-primary text-on-primary hover:bg-primary-container font-body-sm text-body-sm font-semibold transition-all shadow-md flex items-center justify-center gap-space-sm"
              >
                <span>Next: Threat Map →</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
            </div>
          </section>
        </>
      )}

      {/* Modal Integration */}
      <EvidenceUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        caseId="CASE-2026-00124"
        defaultTab={uploadTab}
        onUploadSuccess={() => loadData()}
      />
    </div>
  );
}
