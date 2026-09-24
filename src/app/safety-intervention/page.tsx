'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { logAuditEvent, fetchCurrentCase } from '@/lib/services/cases';
import { getUserCaseId } from '@/lib/auth';

function SafetyInterventionContent() {
  const searchParams = useSearchParams();
  const interceptedUrl = searchParams.get('url') || 'https://corp-bi11ing-us.com/login?auth=cfo_wire';
  const reason = searchParams.get('reason') || 'greedy_click_intercepted';

  const [acknowledged, setAcknowledged] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [activePersona, setActivePersona] = useState<'greedy' | 'cautious' | 'analyst'>('greedy');
  const [showSandboxPreview, setShowSandboxPreview] = useState(true);

  useEffect(() => {
    // Record immutable audit event on mount
    const caseId = getUserCaseId();
    logAuditEvent(
      caseId,
      'AEGIS Safety Gateway',
      `SAFETY INTERVENTION TRIGGERED: Greedy user click intercepted on flagged URL [${interceptedUrl}]. Navigation halted, session quarantined.`
    );
  }, [interceptedUrl]);

  const handleClearIntervention = () => {
    if (!acknowledged) return;
    const caseId = getUserCaseId();
    logAuditEvent(
      caseId,
      'SecOps Re-Verification',
      'User completed mandatory cybersecurity behavioral re-verification. Quarantine lifted.'
    );
    setCleared(true);
  };

  return (
    <div className="flex flex-col w-full pb-space-xl gap-space-lg">
      {/* Top Warning Banner */}
      <div className="p-space-lg rounded-2xl bg-error-container/20 border-2 border-error/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-error text-on-error flex items-center justify-center flex-shrink-0 shadow-lg shadow-error/30 animate-pulse">
            <span className="material-symbols-outlined text-3xl">block</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-error text-on-error font-mono text-[11px] font-bold uppercase tracking-wider">
                SAFETY INTERVENTION ACTIVE
              </span>
              <span className="font-mono text-xs text-error font-bold">
                POLICY #SIH-SEC-2026
              </span>
            </div>
            <h1 className="font-headline-sm text-xl font-bold text-on-surface mt-1">
              Dangerous Navigation Intercepted by AEGIS-TRACE
            </h1>
            <p className="font-body-sm text-xs text-on-surface-variant max-w-2xl mt-0.5">
              A high-risk user click was intercepted on a confirmed phishing/malicious destination. Navigation was stopped and rerouted to the safety intervention gateway to prevent credential exfiltration and wire fraud.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 font-code-sm text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-surface-container-high border border-outline-variant/20 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-error animate-ping" />
            <span className="font-bold text-error">Packet Dropped · Zero Ingress</span>
          </div>
          <span className="text-[11px] text-on-surface-variant font-mono">
            Intercepted: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Target Destination & Block Details */}
      <div className="p-space-lg rounded-xl bg-surface-container border border-outline-variant/20 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15 text-xs font-code-sm">
          <span className="font-bold text-on-surface uppercase tracking-wider">
            Intercepted Destination &amp; Threat Signature
          </span>
          <span className="px-2 py-0.5 rounded bg-surface-container-high text-primary font-mono text-[10px]">
            RFC-822 Link Quarantine
          </span>
        </div>

        <div className="p-3 rounded-lg bg-surface-container-lowest border border-error/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-code-sm">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="material-symbols-outlined text-error text-base">link_off</span>
            <span className="text-on-surface-variant">Flagged Target URL:</span>
            <span className="text-error font-mono font-bold truncate">{interceptedUrl}</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-error/20 text-error font-bold font-mono text-[11px] whitespace-nowrap">
            Credential Harvester
          </span>
        </div>
      </div>

      {/* 2-Column Grid: Behavioral Telemetry & Isolated Sandbox Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* Left Column: User Behavioral Profile & Risk Metrics (5 Cols) */}
        <div className="xl:col-span-5 flex flex-col gap-space-md">
          <div className="p-space-xl rounded-xl bg-surface-container shadow-md border border-outline-variant/20 flex flex-col gap-space-md">
            <div className="flex items-center justify-between pb-space-sm border-b border-outline-variant/15">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-lg">psychology_alt</span>
                <h2 className="font-headline-sm text-base font-bold text-on-surface">
                  User Behavioral Risk Profile
                </h2>
              </div>
              <span className="px-2 py-0.5 rounded bg-secondary/10 text-secondary font-mono text-[10px] font-bold">
                SIH Behavioral AI
              </span>
            </div>

            {/* Persona Switcher for Demonstration */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase font-code-sm">
                Simulate User Behavior Profile:
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'greedy', label: 'Greedy / Impulsive', score: 88, risk: 'Critical Risk' },
                  { id: 'cautious', label: 'Cautious User', score: 24, risk: 'Low Risk' },
                  { id: 'analyst', label: 'Security Lead', score: 5, risk: 'Secure' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setActivePersona(p.id as any)}
                    className={`p-2 rounded-lg text-left text-xs transition-all border ${
                      activePersona === p.id
                        ? 'bg-surface-container-high border-primary text-primary font-bold shadow-sm'
                        : 'bg-surface-container-low border-outline-variant/15 text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <div className="text-[11px]">{p.label}</div>
                    <div className="text-[10px] font-mono text-outline mt-0.5">{p.score}/100</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Behavioral Scorecard */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/15 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-xs font-bold text-on-surface-variant uppercase">
                  Vulnerability Score
                </span>
                <span className={`font-mono text-lg font-bold ${
                  activePersona === 'greedy' ? 'text-error' : activePersona === 'cautious' ? 'text-tertiary' : 'text-primary'
                }`}>
                  {activePersona === 'greedy' ? '88 / 100 (HIGH)' : activePersona === 'cautious' ? '24 / 100 (LOW)' : '05 / 100 (CLEAN)'}
                </span>
              </div>

              {/* Behavioral Indicators */}
              <div className="flex flex-col gap-2 pt-1 border-t border-outline-variant/10 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Greed / Wire Urgency Susceptibility:</span>
                  <span className={`font-mono font-bold ${activePersona === 'greedy' ? 'text-error' : 'text-tertiary'}`}>
                    {activePersona === 'greedy' ? '92% (Critical)' : '18% (Resistant)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Bypassed Warning Banner:</span>
                  <span className={`font-mono font-bold ${activePersona === 'greedy' ? 'text-error' : 'text-tertiary'}`}>
                    {activePersona === 'greedy' ? 'YES (Triggered Intercept)' : 'NO'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Phishing Awareness Rating:</span>
                  <span className={`font-mono font-bold ${activePersona === 'greedy' ? 'text-error' : 'text-tertiary'}`}>
                    {activePersona === 'greedy' ? 'Immediate Remediation Required' : 'Adequate'}
                  </span>
                </div>
              </div>
            </div>

            {/* Mandatory Re-Verification Checklist */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/15 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">checklist</span>
                <span className="font-headline-sm text-xs font-bold text-on-surface">
                  Mandatory Security Re-Verification
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">
                To lift the session quarantine and return to the investigation console, you must acknowledge the threat vector below:
              </p>

              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-surface-container cursor-pointer hover:bg-surface-container-high transition-colors">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 rounded text-primary focus:ring-primary h-4 w-4"
                />
                <span className="text-xs text-on-surface font-medium leading-relaxed">
                  I acknowledge that <strong className="text-primary">corp-bi11ing-us.com</strong> is an unauthorized external lookalike domain created to steal corporate banking credentials.
                </span>
              </label>

              {cleared ? (
                <div className="p-3 rounded-lg bg-tertiary/10 border border-tertiary/30 text-tertiary flex items-center justify-between text-xs font-bold font-code-sm">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span>Re-Verification Approved &amp; Logged to Blockchain Vault</span>
                  </div>
                  <Link
                    href="/stage-1-fast-triage"
                    className="px-3 py-1 rounded bg-tertiary text-on-tertiary hover:bg-tertiary-container transition-all"
                  >
                    Return to SOC →
                  </Link>
                </div>
              ) : (
                <button
                  onClick={handleClearIntervention}
                  disabled={!acknowledged}
                  className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
                    acknowledged
                      ? 'bg-primary text-on-primary hover:bg-primary-container cursor-pointer'
                      : 'bg-surface-container-high text-outline cursor-not-allowed'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">verified_user</span>
                  <span>Submit Security Clearance &amp; Clear Quarantine</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Isolated Sandbox Preview (7 Cols) */}
        <div className="xl:col-span-7 flex flex-col gap-space-md">
          <div className="p-space-xl rounded-xl bg-surface-container shadow-md border border-outline-variant/20 flex flex-col gap-space-md">
            <div className="flex items-center justify-between pb-space-sm border-b border-outline-variant/15">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">terminal</span>
                <div className="flex flex-col">
                  <h2 className="font-headline-sm text-base font-bold text-on-surface">
                    Isolated Web Sandbox (Safe Zero-Risk Preview)
                  </h2>
                  <span className="text-[11px] text-on-surface-variant">
                    Neutralized simulation of the malicious destination rendered without executing scripts
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowSandboxPreview(!showSandboxPreview)}
                className="px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container-high text-on-surface text-xs font-code-sm font-semibold border border-outline-variant/20 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-xs">
                  {showSandboxPreview ? 'visibility_off' : 'visibility'}
                </span>
                <span>{showSandboxPreview ? 'Hide Sandbox' : 'Show Sandbox'}</span>
              </button>
            </div>

            {showSandboxPreview && (
              <div className="rounded-xl border border-outline-variant/30 overflow-hidden shadow-inner bg-surface-container-lowest">
                {/* Mock Browser URL Bar */}
                <div className="p-2.5 bg-surface-container-high border-b border-outline-variant/20 flex items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-error" />
                    <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
                    <span className="w-2.5 h-2.5 rounded-full bg-tertiary" />
                  </div>
                  <div className="flex-1 max-w-md bg-surface-container-lowest px-3 py-1 rounded-md text-[11px] text-error flex items-center gap-1.5 border border-error/30">
                    <span className="material-symbols-outlined text-[13px]">lock_open</span>
                    <span className="truncate">{interceptedUrl}</span>
                  </div>
                  <span className="text-[10px] text-on-surface-variant font-bold px-2 py-0.5 rounded bg-error-container text-on-error-container">
                    SANDBOX QUARANTINED
                  </span>
                </div>

                {/* Simulated Phishing Page Content */}
                <div className="p-6 bg-surface-container-low flex flex-col items-center justify-center text-center gap-4 select-none relative">
                  {/* Warning Overlay Ribbon */}
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-error/90 text-on-error font-mono text-[9px] font-bold uppercase tracking-wider rotate-3 shadow-md">
                    NEUTRALIZED PHISHING
                  </div>

                  <div className="w-12 h-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center border border-primary/30">
                    <span className="material-symbols-outlined text-2xl">account_balance</span>
                  </div>

                  <div className="flex flex-col gap-1 max-w-sm">
                    <h3 className="font-bold text-base text-on-surface">
                      Corporate Wire Approval Portal
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Urgent Wire Payment #WF-98421 Requires Immediate Executive Sign-Off to Release $142,500.00 USD.
                    </p>
                  </div>

                  {/* Fake Phishing Input Fields */}
                  <div className="w-full max-w-xs flex flex-col gap-2.5 text-left text-xs font-code-sm">
                    <div>
                      <label className="text-on-surface-variant text-[11px] block mb-1">
                        Corporate Email / AD Username
                      </label>
                      <input
                        type="text"
                        disabled
                        value="cfo@acme-defense.com"
                        className="w-full bg-surface-container rounded p-2 text-on-surface border border-outline-variant/30 opacity-70 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-on-surface-variant text-[11px] block mb-1">
                        Executive Authorization PIN / Password
                      </label>
                      <input
                        type="password"
                        disabled
                        value="••••••••••••"
                        className="w-full bg-surface-container rounded p-2 text-on-surface border border-outline-variant/30 opacity-70 cursor-not-allowed"
                      />
                    </div>
                    <div className="p-2 rounded bg-error/10 border border-error/20 text-error text-[11px]">
                      ⚠️ <strong>Attacker Action:</strong> This form posts stolen credentials to Tor relay IP <code>185.220.101.5</code>.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Navigation Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-outline-variant/15 text-xs font-code-sm">
              <Link
                href="/stage-1-fast-triage"
                className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant flex items-center gap-1.5 border border-outline-variant/20"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span>Back to Fast Triage</span>
              </Link>
              <Link
                href="/evidence-vault"
                className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex items-center gap-1.5 border border-primary/30 font-bold"
              >
                <span>Inspect Evidence Vault →</span>
                <span className="material-symbols-outlined text-sm">lock</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SafetyInterventionPage() {
  return (
    <Suspense fallback={
      <div className="h-96 flex flex-col items-center justify-center gap-3 text-xs font-code-sm text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-3xl text-primary">sync</span>
        <span>Loading AEGIS Safety Intervention Gateway…</span>
      </div>
    }>
      <SafetyInterventionContent />
    </Suspense>
  );
}
