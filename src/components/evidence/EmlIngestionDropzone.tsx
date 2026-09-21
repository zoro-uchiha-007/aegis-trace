'use client';

import React, { useState, useRef, useCallback } from 'react';
import { ingestAndAnalyzeEml } from '@/lib/services/cases';
import { getUserCaseId } from '@/lib/auth';
import {
  SAMPLE_EML_BEC_SCAM,
  SAMPLE_EML_CREDENTIAL_PHISH,
  SAMPLE_EML_CLEAN,
  ForensicAnalysisResult,
} from '@/lib/forensics/eml-analyzer';

interface EmlIngestionDropzoneProps {
  onAnalyzed?: (result: ForensicAnalysisResult) => void;
  className?: string;
  compact?: boolean;
}

interface FileQueueItem {
  id: string;
  name: string;
  size: number;
  status: 'pending' | 'analyzing' | 'done' | 'failed';
  riskScore?: number;
  severity?: string;
  error?: string;
  content?: string;
}

interface StreamEvent {
  type: 'step' | 'result' | 'error';
  message?: string;
  data?: any;
}

export const EmlIngestionDropzone: React.FC<EmlIngestionDropzoneProps> = ({
  onAnalyzed,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'samples' | 'paste'>('upload');
  const [pastedContent, setPastedContent] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Multi-file queue
  const [fileQueue, setFileQueue] = useState<FileQueueItem[]>([]);
  const [currentProcessingId, setCurrentProcessingId] = useState<string | null>(null);
  const [streamLog, setStreamLog] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log
  React.useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [streamLog]);

  // ── Stream-analyze a single EML string ──────────────────────────────────
  const streamAnalyze = async (
    emlContent: string,
    filename: string,
    queueId: string,
  ) => {
    setCurrentProcessingId(queueId);
    setStreamLog([]);

    const updateQueue = (updates: Partial<FileQueueItem>) =>
      setFileQueue((prev) =>
        prev.map((f) => (f.id === queueId ? { ...f, ...updates } : f)),
      );

    updateQueue({ status: 'analyzing' });

    try {
      const response = await fetch('/api/evidence/analyze-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emlContent,
          caseId: getUserCaseId(),
          filename,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Stream error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let analysisResult: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;
          try {
            const event: StreamEvent = JSON.parse(jsonStr);
            if (event.type === 'step' && event.message) {
              setStreamLog((prev) => [...prev, event.message!]);
            } else if (event.type === 'result') {
              analysisResult = event.data;
            } else if (event.type === 'error') {
              throw new Error(event.message || 'Analysis stream error');
            }
          } catch (parseErr) {
            // skip malformed event
          }
        }
      }

      // Also run client-side analysis for state update
      const fullResult = await ingestAndAnalyzeEml(emlContent, getUserCaseId(), filename);

      updateQueue({
        status: 'done',
        riskScore: analysisResult?.riskScore ?? fullResult.summary.riskScore,
        severity: analysisResult?.severity ?? fullResult.summary.severity,
      });

      if (onAnalyzed) onAnalyzed(fullResult);
    } catch (err: any) {
      updateQueue({ status: 'failed', error: err?.message || 'Analysis failed' });
      setStreamLog((prev) => [...prev, `❌ ${err?.message || 'Analysis failed'}`]);
    } finally {
      setCurrentProcessingId(null);
    }
  };

  // ── Process the whole queue sequentially ────────────────────────────────
  const processQueue = useCallback(
    async (items: FileQueueItem[]) => {
      setIsRunning(true);
      setErrorMsg('');
      for (const item of items) {
        if (item.status !== 'pending' || !item.content) continue;
        await streamAnalyze(item.content, item.name, item.id);
      }
      setIsRunning(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── File input handler (multi-file) ──────────────────────────────────────
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg('');

    const newItems: FileQueueItem[] = [];
    const readers: Promise<void>[] = [];

    Array.from(files).forEach((file) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const item: FileQueueItem = {
        id,
        name: file.name,
        size: file.size,
        status: 'pending',
        content: '',
      };
      newItems.push(item);

      const p = new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          item.content = e.target?.result as string;
          resolve();
        };
        reader.readAsText(file);
      });
      readers.push(p);
    });

    Promise.all(readers).then(() => {
      setFileQueue((prev) => {
        const next = [...prev, ...newItems];
        // Start processing newly added pending items
        processQueue(newItems);
        return next;
      });
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilesSelected(e.target.files);
    // Reset input so same files can be re-selected
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelected(e.dataTransfer.files);
  };

  // ── Sample loaders ───────────────────────────────────────────────────────
  const handleLoadSample = (sampleType: 'bec' | 'phish' | 'clean') => {
    const map = {
      bec: { raw: SAMPLE_EML_BEC_SCAM, name: 'cfo_wire_scam.eml' },
      phish: { raw: SAMPLE_EML_CREDENTIAL_PHISH, name: 'sso_credential_phish.eml' },
      clean: { raw: SAMPLE_EML_CLEAN, name: 'legitimate_quarterly_agenda.eml' },
    };
    const { raw, name } = map[sampleType];
    const id = `sample-${Date.now()}`;
    const item: FileQueueItem = { id, name, size: raw.length, status: 'pending', content: raw };
    setFileQueue((prev) => [...prev, item]);
    processQueue([item]);
  };

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedContent.trim()) {
      setErrorMsg('Please paste raw RFC-822 email text or headers.');
      return;
    }
    const id = `paste-${Date.now()}`;
    const item: FileQueueItem = {
      id,
      name: 'pasted_email_headers.eml',
      size: pastedContent.length,
      status: 'pending',
      content: pastedContent,
    };
    setFileQueue((prev) => [...prev, item]);
    processQueue([item]);
  };

  const clearQueue = () => {
    if (!isRunning) {
      setFileQueue([]);
      setStreamLog([]);
    }
  };

  const severityBadgeClass = (severity?: string) => {
    if (!severity) return 'bg-surface-container text-on-surface-variant border-outline-variant/20';
    if (severity === 'CRITICAL' || severity === 'HIGH')
      return 'bg-error-container/30 text-error border-error/30';
    if (severity === 'MEDIUM') return 'bg-secondary-container/30 text-secondary border-secondary/30';
    return 'bg-tertiary/10 text-tertiary border-tertiary/20';
  };

  const statusIcon = (status: FileQueueItem['status'], id: string) => {
    if (status === 'done') return <span className="material-symbols-outlined text-tertiary text-base">check_circle</span>;
    if (status === 'failed') return <span className="material-symbols-outlined text-error text-base">cancel</span>;
    if (status === 'analyzing' && currentProcessingId === id)
      return <span className="material-symbols-outlined text-primary text-base animate-spin">refresh</span>;
    return <span className="material-symbols-outlined text-outline text-base">hourglass_empty</span>;
  };

  const doneCount = fileQueue.filter((f) => f.status === 'done').length;
  const threatCount = fileQueue.filter(
    (f) => f.status === 'done' && f.riskScore !== undefined && f.riskScore > 50,
  ).length;

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
              AEGIS-TRACE EML Forensic Ingestion
            </span>
            <span className="font-label-sm text-[11px] text-on-surface-variant">
              Multi-file upload with live streaming forensic analysis pipeline
            </span>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-surface-container-low p-1 rounded-lg border border-outline-variant/15">
          {(['upload', 'samples', 'paste'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                activeTab === tab
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {tab === 'upload' ? 'Upload Files' : tab === 'samples' ? '1-Click Samples' : 'Paste Headers'}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="p-6 flex flex-col gap-4">
        {/* ── Upload Tab ── */}
        {activeTab === 'upload' && (
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
              multiple
            />
            <div className="w-14 h-14 rounded-2xl bg-surface-container-high flex items-center justify-center text-primary shadow-inner border border-primary/20">
              <span className="material-symbols-outlined text-3xl">upload_file</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-headline-sm text-base font-bold text-on-surface">
                Drop <code className="text-primary font-mono font-bold">.EML</code> files here, or click to browse
              </span>
              <span className="text-xs text-on-surface-variant">
                Supports multiple files — .eml, .msg, .txt (RFC-822 formatted)
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
              {['✓ Multi-file Queue', '✓ Live Stream Analysis', '✓ SPF/DKIM/DMARC', '✓ IOC Graph'].map((tag) => (
                <span key={tag} className="px-2.5 py-1 rounded bg-surface-container font-code-sm text-[11px] text-on-surface-variant border border-outline-variant/15">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Samples Tab ── */}
        {activeTab === 'samples' && (
          <div className="flex flex-col gap-3">
            <span className="font-label-sm text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
              Select a pre-loaded forensic test case to analyze instantly:
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  type: 'bec' as const,
                  label: 'BEC Wire Transfer Fraud',
                  badge: 'Critical Threat (91%)',
                  badgeClass: 'bg-error-container text-on-error-container',
                  border: 'border-error/30 hover:border-error',
                  desc: 'Spoofed lookalike domain, SPF/DMARC fail, $428.5k invoice wire demand.',
                },
                {
                  type: 'phish' as const,
                  label: 'SSO Credential Harvest',
                  badge: 'Medium Threat (74%)',
                  badgeClass: 'bg-secondary-container text-on-secondary-container',
                  border: 'border-secondary/30 hover:border-secondary',
                  desc: 'Fake IT security urgent password reset lure with embedded harvesting URL.',
                },
                {
                  type: 'clean' as const,
                  label: 'Legitimate Corporate Email',
                  badge: 'Clean (15% Low)',
                  badgeClass: 'bg-tertiary-container text-on-tertiary-container',
                  border: 'border-tertiary/30 hover:border-tertiary',
                  desc: 'Valid SPF pass, valid DKIM pass, matching DMARC policy.',
                },
              ].map((s) => (
                <button
                  key={s.type}
                  type="button"
                  onClick={() => handleLoadSample(s.type)}
                  disabled={isRunning}
                  className={`flex flex-col text-left p-4 rounded-xl bg-surface-container-low hover:bg-surface-container-high border ${s.border} transition-all group shadow-sm disabled:opacity-50`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <span className={`px-2 py-0.5 rounded ${s.badgeClass} text-[10px] font-bold uppercase font-mono`}>
                      {s.badge}
                    </span>
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform text-sm">
                      arrow_forward
                    </span>
                  </div>
                  <span className="font-headline-sm text-sm font-bold text-on-surface mb-1">{s.label}</span>
                  <p className="font-body-sm text-xs text-on-surface-variant line-clamp-2">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Paste Tab ── */}
        {activeTab === 'paste' && (
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
                disabled={isRunning}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-semibold text-xs transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">science</span>
                <span>Analyze Pasted Email</span>
              </button>
            </div>
          </form>
        )}

        {errorMsg && (
          <div className="p-3 rounded-lg bg-error-container/30 border border-error/30 text-error text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ── File Queue ── */}
        {fileQueue.length > 0 && (
          <div className="flex flex-col gap-3">
            {/* Queue header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wider font-code-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-sm">queue</span>
                Analysis Queue ({fileQueue.length} file{fileQueue.length > 1 ? 's' : ''})
              </span>
              {!isRunning && (
                <button
                  onClick={clearQueue}
                  className="text-xs text-on-surface-variant hover:text-error transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">delete_sweep</span>
                  Clear All
                </button>
              )}
            </div>

            {/* Summary bar (when done) */}
            {doneCount > 0 && doneCount === fileQueue.length && (
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${threatCount > 0 ? 'bg-error-container/20 border-error/30 text-error' : 'bg-tertiary/10 border-tertiary/20 text-tertiary'}`}>
                <span className="material-symbols-outlined text-xl">
                  {threatCount > 0 ? 'warning' : 'verified'}
                </span>
                <div>
                  <div className="text-sm font-bold">
                    {threatCount > 0
                      ? `${threatCount} threat${threatCount > 1 ? 's' : ''} detected across ${doneCount} emails`
                      : `All ${doneCount} emails analyzed — no threats found`}
                  </div>
                  <div className="text-[11px] opacity-70">Analysis complete · Check Stage 1 dashboard for full results</div>
                </div>
              </div>
            )}

            {/* File rows */}
            <div className="rounded-xl border border-outline-variant/20 overflow-hidden divide-y divide-outline-variant/10">
              {fileQueue.map((item) => (
                <div key={item.id} className={`flex items-center gap-3 px-4 py-3 ${item.status === 'analyzing' ? 'bg-primary/[0.04]' : 'bg-surface-container-low'}`}>
                  {/* Status icon */}
                  <div className="flex-shrink-0">
                    {statusIcon(item.status, item.id)}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-on-surface truncate">{item.name}</div>
                    <div className="text-[11px] text-on-surface-variant font-code-sm">
                      {(item.size / 1024).toFixed(1)} KB
                      {item.error && <span className="text-error ml-1">· {item.error}</span>}
                    </div>
                  </div>

                  {/* Status / risk badge */}
                  <div className="flex-shrink-0">
                    {item.status === 'done' && item.riskScore !== undefined ? (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${severityBadgeClass(item.severity)}`}>
                        {item.riskScore}% · {item.severity}
                      </span>
                    ) : item.status === 'analyzing' && currentProcessingId === item.id ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1 animate-pulse">
                        Streaming...
                      </span>
                    ) : item.status === 'failed' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-error-container/30 text-error border border-error/20">
                        Failed
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono text-outline border border-outline-variant/20">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Live stream log */}
            {streamLog.length > 0 && (
              <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-outline-variant/15 bg-surface-container">
                  <span className="material-symbols-outlined text-primary text-sm">terminal</span>
                  <span className="text-xs font-bold text-on-surface uppercase tracking-wider font-code-sm">Live Forensic Log</span>
                  {isRunning && <span className="w-2 h-2 rounded-full bg-primary animate-ping ml-auto" />}
                </div>
                <div
                  ref={logRef}
                  className="p-4 space-y-1.5 max-h-48 overflow-y-auto font-code-sm text-[11px]"
                >
                  {streamLog.map((line, i) => (
                    <div key={i} className="flex items-start gap-2 text-on-surface-variant">
                      <span className="text-outline font-mono flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                      <span className={i === streamLog.length - 1 && isRunning ? 'text-primary' : ''}>{line}</span>
                    </div>
                  ))}
                  {isRunning && (
                    <div className="flex items-center gap-2 text-primary">
                      <span className="text-outline font-mono">··</span>
                      <span className="animate-pulse">▊</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
