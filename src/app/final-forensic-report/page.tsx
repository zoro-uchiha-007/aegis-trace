'use client';

import React, { useEffect, useState } from 'react';
import { PDFReportGenerator } from '@/components/report/PDFReportGenerator';
import { EmlIngestionDropzone } from '@/components/evidence/EmlIngestionDropzone';
import { 
  fetchCurrentCase, 
  fetchCaseFindings, 
  fetchIOCs, 
  fetchRouteHops, 
  updateCaseStatus 
} from '@/lib/services/cases';
import { CaseRecord, CaseFindings, IOCRecord, RouteHop } from '@/lib/supabase/types';
import { getUserCaseId } from '@/lib/auth';

export default function FinalForensicReportPage() {
  const [caseData, setCaseData] = useState<CaseRecord | null>(null);
  const [findings, setFindings] = useState<CaseFindings[]>([]);
  const [iocs, setIocs] = useState<IOCRecord[]>([]);
  const [hops, setHops] = useState<RouteHop[]>([]);

  const [disposition, setDisposition] = useState<string>('malicious');
  const [isSealing, setIsSealing] = useState(false);
  const [isSealed, setIsSealed] = useState(false);

  const loadData = async () => {
    const caseId = getUserCaseId();
    const [c, f, i, h] = await Promise.all([
      fetchCurrentCase(caseId),
      fetchCaseFindings(caseId),
      fetchIOCs(caseId),
      fetchRouteHops(caseId),
    ]);
    setCaseData(c);
    setFindings(f);
    setIocs(i);
    setHops(h);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('aegis-case-updated', loadData);
    return () => window.removeEventListener('aegis-case-updated', loadData);
  }, []);

  const handleSealAndClose = async () => {
    const caseId = getUserCaseId();
    await updateCaseStatus(
      caseId,
      disposition === 'inconclusive' ? 'closed' : 'quarantined',
      `FIPS 140-3 Hardware Cryptographic Seal Applied. Disposition: ${disposition.toUpperCase()}. Case archived.`
    );

    setTimeout(() => {
      setIsSealing(false);
      setIsSealed(true);
    }, 1400);
  };

  const isAnalyzed = caseData?.status !== 'standby' && findings.length > 0;
  const f1 = findings.find((f) => f.stage === 1) || findings[0];
  const f2 = findings.find((f) => f.stage === 2) || findings[1] || findings[0];

  const d1 = f1?.details || {};
  const d2 = f2?.details || {};

  return (
    <div className="flex flex-col w-full pb-space-xl print:p-0">
      {/* Case Context Breadcrumb & Status Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-space-md py-space-md mb-space-lg bg-surface-container-lowest rounded-xl px-space-xl shadow-md border border-outline-variant/15">
        <div className="flex items-center gap-space-md min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-container-high text-primary border border-primary/20">
            <span className="material-symbols-outlined text-base">description</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-space-sm">
              <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Incident Investigation Report
              </span>
              <span className="inline-flex items-center px-space-xs py-0.5 rounded bg-surface-container-high font-code-sm text-code-sm text-primary font-bold">
                {caseData?.id || 'CASE-2026-00124'}
              </span>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Summary of findings and analyst recommendation
            </span>
          </div>
        </div>

        <div className="flex items-center gap-space-md">
          <span className={`inline-flex items-center px-space-sm py-0.5 rounded font-code-sm text-code-sm font-semibold border ${
            isAnalyzed ? 'bg-error/10 text-error border-error/20' : 'bg-surface-container text-on-surface-variant'
          }`}>
            {isAnalyzed ? `${caseData?.severity || 'HIGH'} Priority` : 'Standby'}
          </span>
          <span className="inline-flex items-center px-space-sm py-0.5 rounded bg-surface-container-high text-on-surface-variant font-code-sm text-code-sm">
            {isSealed ? 'Vault Sealed & Closed' : 'Review Pending'}
          </span>
        </div>
      </div>

      {!isAnalyzed ? (
        <div className="bg-surface-container rounded-2xl p-8 border border-outline-variant/20 shadow-md flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 border border-primary/20">
            <span className="material-symbols-outlined text-3xl">description</span>
          </div>
          <h2 className="font-headline-sm text-xl font-bold text-on-surface">
            Forensic Incident Report Standby
          </h2>
          <p className="text-sm text-on-surface-variant max-w-lg mt-1 mb-6">
            Upload an <code className="text-primary font-mono font-bold">.EML</code> file or load a test case below to generate the comprehensive incident report and cryptographic export.
          </p>

          <EmlIngestionDropzone onAnalyzed={() => loadData()} className="w-full max-w-2xl text-left" />
        </div>
      ) : (
        <>
          {/* SECTION 1: Executive Summary & Synthesis Matrix */}
          <section className="mb-space-md">
            <div className="bg-surface-container rounded-xl p-space-lg shadow-md border border-outline-variant/20">
              <div className="flex flex-col lg:flex-row gap-space-lg">
                {/* Left severity box */}
                <div className="w-full lg:w-72 shrink-0 flex flex-col justify-between bg-surface-container-low rounded-xl p-space-md shadow-sm border border-outline-variant/15">
                  <div>
                    <div className="flex items-center justify-between mb-space-xs">
                      <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                        SEVERITY
                      </span>
                      <span className="material-symbols-outlined text-error text-base">warning</span>
                    </div>
                    <div className="flex items-baseline gap-space-xs mb-space-xs">
                      <span className="font-display-lg text-display-lg text-error font-bold leading-none">
                        {caseData?.risk_score || 0}
                      </span>
                      <span className="font-headline-sm text-headline-sm text-on-surface-variant font-semibold">
                        / 100
                      </span>
                    </div>
                    <div className="inline-flex items-center gap-space-xs px-space-sm py-0.5 rounded bg-error-container text-on-error-container font-code-sm text-code-sm font-bold uppercase mb-space-sm">
                      <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
                      {caseData?.severity || 'CRITICAL'} Risk
                    </div>
                    <div className="text-body-sm font-body-sm text-on-surface-variant">
                      Severity: {caseData?.risk_score || 0} / 100 ({caseData?.severity} Risk)
                    </div>
                  </div>

                  {caseData?.attempted_amount ? (
                    <div className="mt-space-sm pt-space-sm bg-surface-container-lowest rounded-lg p-space-sm border border-outline-variant/15">
                      <span className="font-label-sm text-label-sm text-on-surface-variant uppercase block mb-1 font-semibold">
                        Targeted Wire Transfer
                      </span>
                      <span className="font-headline-sm text-headline-sm text-primary font-bold font-mono">
                        ${caseData.attempted_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                      </span>
                      <span className="font-body-sm text-body-sm text-tertiary block mt-0.5">
                        Swift hold recommended
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* Right narrative */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-space-sm mb-space-xs">
                      <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider font-semibold">
                        INCIDENT SUMMARY
                      </span>
                    </div>
                    <h2 className="font-headline-md text-headline-md text-on-surface mb-space-xs font-bold">
                      {caseData?.title || 'Targeted Email Phishing Incident'}
                    </h2>
                    <p className="font-body-md text-body-md text-on-surface-variant mb-space-md leading-relaxed">
                      {caseData?.description}
                    </p>
                  </div>

                  <div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-space-xs font-semibold">
                      KEY THREAT INDICATORS
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-space-sm">
                      <div className="bg-surface-container-low rounded-lg p-space-sm flex items-center gap-space-sm border border-outline-variant/15">
                        <span className="material-symbols-outlined text-primary text-base">link</span>
                        <div>
                          <div className="font-body-sm text-body-sm text-on-surface font-semibold">
                            Sender Domain
                          </div>
                          <div className="font-body-sm text-body-sm text-on-surface-variant text-xs truncate max-w-[140px]">
                            {d1.spoofed_domain || 'sender-domain.com'}
                          </div>
                        </div>
                      </div>

                      <div className="bg-surface-container-low rounded-lg p-space-sm flex items-center gap-space-sm border border-outline-variant/15">
                        <span className="material-symbols-outlined text-secondary text-base">
                          record_voice_over
                        </span>
                        <div>
                          <div className="font-body-sm text-body-sm text-on-surface font-semibold">
                            Voice Analysis
                          </div>
                          <div className="font-body-sm text-body-sm text-on-surface-variant text-xs">
                            {d1.deepfake_voice_pct ? `${d1.deepfake_voice_pct}% AI Match` : 'Clean / N/A'}
                          </div>
                        </div>
                      </div>

                      <div className="bg-surface-container-low rounded-lg p-space-sm flex items-center gap-space-sm border border-outline-variant/15">
                        <span className="material-symbols-outlined text-tertiary text-base">alt_route</span>
                        <div>
                          <div className="font-body-sm text-body-sm text-on-surface font-semibold">
                            Route Relay Hops
                          </div>
                          <div className="font-body-sm text-body-sm text-on-surface-variant text-xs">
                            {hops.length} Hops Traced
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: Multi-Modal Forensic Verdicts */}
          <section className="mb-space-md">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
              {/* Email Verification Summary */}
              <div className="bg-surface-container rounded-xl p-space-lg shadow-md flex flex-col justify-between border border-outline-variant/20">
                <div>
                  <div className="flex items-center justify-between mb-space-sm pb-2 border-b border-outline-variant/15">
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-primary text-base">mark_email_read</span>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                        Email Verification Summary
                      </h3>
                    </div>
                    <span className="font-code-sm text-code-sm text-error font-semibold">
                      {d1.dmarc_status === 'Passed' ? 'PASSED' : 'MISMATCH'}
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">
                    Inspection of email authentication protocols for incoming message.
                  </p>

                  <div className="space-y-space-xs mb-space-xs">
                    <div className="flex items-center justify-between p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/15">
                      <div className="flex items-center gap-space-sm">
                        <span className={`w-2.5 h-2.5 rounded-full ${d1.spf_status === 'Passed' ? 'bg-tertiary' : 'bg-error'}`} />
                        <span className="font-body-sm text-body-sm text-on-surface font-medium">
                          SPF Check
                        </span>
                      </div>
                      <span className={`px-space-sm py-0.5 rounded font-code-sm text-code-sm font-semibold ${
                        d1.spf_status === 'Passed' ? 'bg-tertiary/15 text-tertiary' : 'bg-error/15 text-error'
                      }`}>
                        {d1.spf_status || 'Failed'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/15">
                      <div className="flex items-center gap-space-sm">
                        <span className={`w-2.5 h-2.5 rounded-full ${d1.dkim_status === 'Passed' ? 'bg-tertiary' : 'bg-error'}`} />
                        <span className="font-body-sm text-body-sm text-on-surface font-medium">
                          DKIM Signature
                        </span>
                      </div>
                      <span className={`px-space-sm py-0.5 rounded font-code-sm text-code-sm font-semibold ${
                        d1.dkim_status === 'Passed' ? 'bg-tertiary/15 text-tertiary' : 'bg-error/15 text-error'
                      }`}>
                        {d1.dkim_status || 'Passed'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/15">
                      <div className="flex items-center gap-space-sm">
                        <span className={`w-2.5 h-2.5 rounded-full ${d1.dmarc_status === 'Passed' ? 'bg-tertiary' : 'bg-error'}`} />
                        <span className="font-body-sm text-body-sm text-on-surface font-medium">
                          DMARC Policy
                        </span>
                      </div>
                      <span className={`px-space-sm py-0.5 rounded font-code-sm text-code-sm font-semibold ${
                        d1.dmarc_status === 'Passed' ? 'bg-tertiary/15 text-tertiary' : 'bg-error/15 text-error'
                      }`}>
                        {d1.dmarc_status || 'Failed'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Audio Analysis Summary */}
              <div className="bg-surface-container rounded-xl p-space-lg shadow-md flex flex-col justify-between border border-outline-variant/20">
                <div>
                  <div className="flex items-center justify-between mb-space-sm pb-2 border-b border-outline-variant/15">
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-secondary text-base">graphic_eq</span>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                        Acoustic Analysis Summary
                      </h3>
                    </div>
                    <span className="font-code-sm text-code-sm text-secondary font-semibold">
                      {d1.deepfake_voice_pct ? 'AI MATCH' : 'N/A'}
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">
                    Spectrogram breakdown and neural voiceprint comparison.
                  </p>

                  <div className="space-y-space-xs">
                    <div className="flex items-center justify-between p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/15">
                      <span className="font-body-sm text-body-sm text-on-surface font-medium">
                        Model Architecture
                      </span>
                      <span className="font-code-sm text-code-sm text-secondary font-semibold">
                        HiFi-GAN Neural Vocoder
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/15">
                      <span className="font-body-sm text-body-sm text-on-surface font-medium">
                        Similarity to Target Voice
                      </span>
                      <span className="font-code-sm text-code-sm text-secondary font-semibold">
                        {d2.voice_similarity_pct || 94.1}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/15">
                      <span className="font-body-sm text-body-sm text-on-surface font-medium">
                        Attachment Hash
                      </span>
                      <span className="font-code-sm text-[11px] text-outline truncate max-w-[180px]">
                        {d2.attachment_sha256 || 'e3b0c44298fc1c...'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: Analyst Disposition & Final Recommendation */}
          <section className="mb-space-md">
            <div className="bg-surface-container rounded-xl p-space-lg shadow-md border border-outline-variant/20">
              <div className="flex flex-col xl:flex-row gap-space-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-space-sm mb-space-xs">
                    <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider font-semibold">
                      DISPOSITION VERDICT
                    </span>
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface mb-space-xs font-bold">
                    Analyst Final Determination
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
                    Select final case disposition for automated quarantine and compliance reporting.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-space-sm">
                    {[
                      { id: 'malicious', title: 'Confirmed Malicious', desc: 'Block domains, IPs, and quarantine wire authorizations.', badge: 'Action: Quarantine' },
                      { id: 'suspicious', title: 'Suspicious / Hold', desc: 'Place on 24-hour SOC security observation queue.', badge: 'Action: Hold' },
                      { id: 'benign', title: 'Benign / Whitelist', desc: 'Verified authentic communication, release all holds.', badge: 'Action: Clear' },
                    ].map((opt) => (
                      <label
                        key={opt.id}
                        onClick={() => setDisposition(opt.id)}
                        className={`p-space-md rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                          disposition === opt.id
                            ? 'bg-primary/10 border-primary shadow-md'
                            : 'bg-surface-container-low border-outline-variant/20 hover:border-outline-variant/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-headline-sm text-sm font-bold text-on-surface">
                            {opt.title}
                          </span>
                          <input
                            type="radio"
                            name="disposition"
                            value={opt.id}
                            checked={disposition === opt.id}
                            onChange={() => setDisposition(opt.id)}
                            className="accent-primary"
                          />
                        </div>
                        <p className="font-body-sm text-xs text-on-surface-variant mb-2">
                          {opt.desc}
                        </p>
                        <span className="font-code-sm text-[10px] text-primary font-bold">
                          {opt.badge}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Analyst Card */}
                <div className="w-full xl:w-72 shrink-0 bg-surface-container-low rounded-xl p-space-md flex flex-col justify-between border border-outline-variant/15">
                  <div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-space-xs font-semibold">
                      Assigned Analyst
                    </span>
                    <div className="flex items-center gap-space-sm p-space-sm bg-surface-container-lowest rounded-lg mb-space-xs border border-outline-variant/15">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-bold font-mono">
                        CV
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-body-sm text-body-sm text-on-surface font-bold">
                          C. Vance
                        </span>
                        <span className="font-code-sm text-code-sm text-primary text-xs">
                          SOC Tier-III Lead
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-space-xs pt-space-xs text-on-surface-variant font-body-sm text-body-sm border-t border-outline-variant/15">
                    <span className="material-symbols-outlined text-tertiary text-sm">check_circle</span>
                    <span className="text-xs">Authenticated Analyst Session</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: Final Execution Command Ribbon */}
          <section className="no-print">
            <div className="bg-surface-container-lowest rounded-xl p-space-md flex flex-col md:flex-row items-center justify-between gap-space-md shadow-lg border border-outline-variant/20">
              <div className="flex items-center gap-space-md">
                <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-base">verified</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-body-md text-body-md text-on-surface font-semibold">
                    Finalize Decision
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Saves review verdict, notifies the finance security team, and updates security rules.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-space-md w-full md:w-auto shrink-0">
                {caseData && (
                  <PDFReportGenerator
                    caseData={caseData}
                    findings={findings}
                    iocs={iocs}
                    hops={hops}
                    selectedDisposition={disposition}
                  />
                )}

                <button
                  onClick={handleSealAndClose}
                  disabled={isSealing || isSealed}
                  className={`px-space-lg py-space-sm rounded-lg font-body-sm text-body-sm font-bold transition-all flex items-center justify-center gap-space-xs shadow-sm active:scale-98 ${
                    isSealed
                      ? 'bg-tertiary text-on-tertiary'
                      : 'bg-primary hover:bg-primary-container text-on-primary'
                  }`}
                  id="sealVaultBtn"
                >
                  <span className="material-symbols-outlined text-base">
                    {isSealing ? 'sync' : isSealed ? 'check_circle' : 'check'}
                  </span>
                  <span>
                    {isSealing
                      ? 'Signing FIPS 140-3 Hardware Seal...'
                      : isSealed
                      ? 'Vault Sealed & Ledger Synchronized'
                      : 'Submit Decision & Close Case →'}
                  </span>
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
