'use client';

import React, { useState, useRef } from 'react';
import { ingestAndAnalyzeEml } from '@/lib/services/cases';
import { getUserCaseId } from '@/lib/auth';
import { 
  SAMPLE_EML_BEC_SCAM, 
  SAMPLE_EML_CREDENTIAL_PHISH, 
  SAMPLE_EML_CLEAN, 
  ForensicAnalysisResult 
} from '@/lib/forensics/eml-analyzer';

interface EmlIngestionDropzoneProps {
  onAnalyzed?: (result: ForensicAnalysisResult) => void;
  className?: string;
  compact?: boolean;
}

export const EmlIngestionDropzone: React.FC<EmlIngestionDropzoneProps> = ({
  onAnalyzed,
  className = '',
  compact = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState('');
  const [activeTab, setActiveTab] = useState<'upload' | 'samples' | 'paste'>('upload');
  const [pastedContent, setPastedContent] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processEmlContent = async (rawContent: string, filename?: string) => {
    setIsAnalyzing(true);
    setErrorMsg('');
    setAnalysisStep('Reading RFC-822 MIME headers & boundary envelopes...');

    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setAnalysisStep('Evaluating SPF / DKIM / DMARC authentication alignments...');
      
      await new Promise((resolve) => setTimeout(resolve, 300));
      setAnalysisStep('Extracting network relay hops & resolving IP telemetry...');
      
      await new Promise((resolve) => setTimeout(resolve, 300));
      setAnalysisStep('Constructing IOC threat graph & calculating multi-vector risk score...');

      const result = await ingestAndAnalyzeEml(rawContent, getUserCaseId(), filename);

      await new Promise((resolve) => setTimeout(resolve, 200));
      setIsAnalyzing(false);
      setAnalysisStep('');

      if (onAnalyzed) {
        onAnalyzed(result);
      }
    } catch (err: any) {
      setIsAnalyzing(false);
      setErrorMsg(err?.message || 'Failed to parse and analyze EML file.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        processEmlContent(text, file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        processEmlContent(text, file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleLoadSample = (sampleType: 'bec' | 'phish' | 'clean') => {
    let raw = SAMPLE_EML_BEC_SCAM;
    let name = 'cfo_wire_scam.eml';
    if (sampleType === 'phish') {
      raw = SAMPLE_EML_CREDENTIAL_PHISH;
      name = 'sso_credential_phish.eml';
    } else if (sampleType === 'clean') {
      raw = SAMPLE_EML_CLEAN;
      name = 'legitimate_quarterly_agenda.eml';
    }
    processEmlContent(raw, name);
  };

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedContent.trim()) {
      setErrorMsg('Please paste raw RFC-822 email text or headers.');
      return;
    }
    processEmlContent(pastedContent, 'pasted_email_headers.eml');
  };

  return (
    <div className={`flex flex-col bg-surface-container rounded-2xl border border-outline-variant/25 shadow-xl overflow-hidden ${className}`}>
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-surface-container-high/60 border-b border-outline-variant/15">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-sm">
            <span className="material-symbols-outlined text-lg">mail_lock</span>
          </div>
          <div className="flex flex-col">
            <span className="font-headline-sm text-sm font-bold text-on-surface">
              Aegis-Trace EML Forensic Ingestion
            </span>
            <span className="font-label-sm text-[11px] text-on-surface-variant">
              Extracts headers, SPF/DKIM/DMARC protocols, IP hops, and evaluates multi-vector threat risk.
            </span>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-surface-container-low p-1 rounded-lg border border-outline-variant/15">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
              activeTab === 'upload'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Upload .EML File
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('samples')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
              activeTab === 'samples'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            1-Click Threat Samples
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
              activeTab === 'paste'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Paste Headers
          </button>
        </div>
      </div>

      {/* Body Area */}
      <div className="p-6">
        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <span className="material-symbols-outlined text-2xl text-primary animate-pulse">
                biotech
              </span>
            </div>
            <h3 className="font-headline-sm text-base font-bold text-on-surface">
              Analyzing Email Telemetry...
            </h3>
            <p className="font-code-sm text-xs text-primary mt-2 max-w-md animate-pulse">
              {analysisStep}
            </p>
          </div>
        ) : activeTab === 'upload' ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all flex flex-col items-center justify-center gap-3 ${
              isDragging
                ? 'border-primary bg-primary/10 scale-[1.01]'
                : 'border-outline-variant/30 hover:border-primary/50 hover:bg-surface-container-high/40 bg-surface-container-low/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".eml,.msg,.txt,message/rfc822"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-14 h-14 rounded-2xl bg-surface-container-high flex items-center justify-center text-primary shadow-inner border border-primary/20">
              <span className="material-symbols-outlined text-3xl">upload_file</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-headline-sm text-base font-bold text-on-surface">
                Drop your <code className="text-primary font-mono font-bold">.EML</code> file here, or click to browse
              </span>
              <span className="text-xs text-on-surface-variant">
                Supports RFC-822 formatted raw email dumps, Outlook/Thunderbird exported emails (.eml, .msg, .txt)
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2.5 py-1 rounded bg-surface-container font-code-sm text-[11px] text-on-surface-variant border border-outline-variant/15">
                ✓ SPF/DKIM/DMARC Check
              </span>
              <span className="px-2.5 py-1 rounded bg-surface-container font-code-sm text-[11px] text-on-surface-variant border border-outline-variant/15">
                ✓ Hop Relay Extractor
              </span>
              <span className="px-2.5 py-1 rounded bg-surface-container font-code-sm text-[11px] text-on-surface-variant border border-outline-variant/15">
                ✓ Dynamic Threat Graph
              </span>
            </div>
          </div>
        ) : activeTab === 'samples' ? (
          <div className="flex flex-col gap-3">
            <span className="font-label-sm text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
              Select a pre-loaded forensic test case to analyze instantly:
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Sample 1: Critical BEC Wire Scam */}
              <button
                type="button"
                onClick={() => handleLoadSample('bec')}
                className="flex flex-col text-left p-4 rounded-xl bg-surface-container-low hover:bg-surface-container-high border border-error/30 hover:border-error transition-all group shadow-sm"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container text-[10px] font-bold uppercase font-mono">
                    Critical Threat (91%)
                  </span>
                  <span className="material-symbols-outlined text-error group-hover:translate-x-1 transition-transform text-sm">
                    arrow_forward
                  </span>
                </div>
                <span className="font-headline-sm text-sm font-bold text-on-surface mb-1">
                  BEC Wire Transfer Fraud
                </span>
                <p className="font-body-sm text-xs text-on-surface-variant line-clamp-2">
                  Spoofed lookalike domain (<code className="text-error font-mono">corp-bi11ing-us.com</code>), SPF/DMARC fail, $428.5k invoice wire demand.
                </p>
              </button>

              {/* Sample 2: Credential Harvester */}
              <button
                type="button"
                onClick={() => handleLoadSample('phish')}
                className="flex flex-col text-left p-4 rounded-xl bg-surface-container-low hover:bg-surface-container-high border border-secondary/30 hover:border-secondary transition-all group shadow-sm"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase font-mono">
                    Medium Threat (74%)
                  </span>
                  <span className="material-symbols-outlined text-secondary group-hover:translate-x-1 transition-transform text-sm">
                    arrow_forward
                  </span>
                </div>
                <span className="font-headline-sm text-sm font-bold text-on-surface mb-1">
                  SSO Credential Harvest
                </span>
                <p className="font-body-sm text-xs text-on-surface-variant line-clamp-2">
                  Fake IT security urgent password reset lure with embedded harvesting URL and missing DKIM.
                </p>
              </button>

              {/* Sample 3: Clean Legitimate Email */}
              <button
                type="button"
                onClick={() => handleLoadSample('clean')}
                className="flex flex-col text-left p-4 rounded-xl bg-surface-container-low hover:bg-surface-container-high border border-tertiary/30 hover:border-tertiary transition-all group shadow-sm"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <span className="px-2 py-0.5 rounded bg-tertiary-container text-on-tertiary-container text-[10px] font-bold uppercase font-mono">
                    Clean (15% Low)
                  </span>
                  <span className="material-symbols-outlined text-tertiary group-hover:translate-x-1 transition-transform text-sm">
                    arrow_forward
                  </span>
                </div>
                <span className="font-headline-sm text-sm font-bold text-on-surface mb-1">
                  Legitimate Corporate Email
                </span>
                <p className="font-body-sm text-xs text-on-surface-variant line-clamp-2">
                  Valid SPF pass, valid DKIM pass, matching DMARC policy from genuine partner organization.
                </p>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePasteSubmit} className="flex flex-col gap-3">
            <textarea
              value={pastedContent}
              onChange={(e) => setPastedContent(e.target.value)}
              placeholder="Paste raw email RFC-822 text or headers here (including From, To, Subject, Received: headers)..."
              rows={6}
              className="w-full bg-surface-container-low rounded-xl p-3 font-mono text-xs text-on-surface placeholder:text-outline border border-outline-variant/20 focus:outline-none focus:border-primary"
            />
            <div className="flex justify-end gap-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-semibold text-xs transition-all flex items-center gap-1.5 shadow-md"
              >
                <span className="material-symbols-outlined text-sm">science</span>
                <span>Analyze Pasted Email</span>
              </button>
            </div>
          </form>
        )}

        {errorMsg && (
          <div className="mt-3 p-3 rounded-lg bg-error-container/30 border border-error/30 text-error text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">error</span>
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
};
