'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  initiateGmailOAuth,
  saveGmailToken,
  getGmailToken,
  getGmailUserEmail,
  clearGmailToken,
  isGmailConnected,
  fetchInboxMessages,
  fetchRawEml,
  GmailMessage,
} from '@/lib/gmail/gmail-client';
import { ingestAndAnalyzeEml } from '@/lib/services/cases';
import { getUserCaseId } from '@/lib/auth';

interface StreamEvent {
  type: 'step' | 'result' | 'error';
  message?: string;
  data?: any;
}

interface AnalyzedResult {
  messageId: string;
  riskScore: number;
  severity: string;
  verdict: string;
  spfStatus: string;
  dkimStatus: string;
  dmarcStatus: string;
}

interface GmailInboxPanelProps {
  onEmailAnalyzed?: () => void;
}

const POLL_INTERVAL = 30; // seconds

export const GmailInboxPanel: React.FC<GmailInboxPanelProps> = ({ onEmailAnalyzed }) => {
  const [connected, setConnected] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [isLoadingInbox, setIsLoadingInbox] = useState(false);
  const [inboxError, setInboxError] = useState('');

  // Streaming analysis state
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [streamLog, setStreamLog] = useState<string[]>([]);
  const [streamResult, setStreamResult] = useState<StreamEvent['data'] | null>(null);
  const [analyzedResults, setAnalyzedResults] = useState<Map<string, AnalyzedResult>>(new Map());

  // Countdown for next auto-refresh
  const [countdown, setCountdown] = useState(POLL_INTERVAL);
  const logRef = useRef<HTMLDivElement>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Handle OAuth callback token from URL params ──────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('gmail_token');
    const expiresIn = params.get('gmail_expires_in');
    const email = params.get('gmail_email');
    const gmailError = params.get('gmail_error');

    if (token) {
      saveGmailToken(token, parseInt(expiresIn || '3600'), email || undefined);
      setConnected(true);
      setUserEmail(email || '');
      // Clean URL
      const clean = new URL(window.location.href);
      clean.searchParams.delete('gmail_token');
      clean.searchParams.delete('gmail_expires_in');
      clean.searchParams.delete('gmail_email');
      window.history.replaceState({}, '', clean.toString());
    } else if (gmailError) {
      setInboxError(`Gmail connection failed: ${gmailError.replace(/_/g, ' ')}`);
      const clean = new URL(window.location.href);
      clean.searchParams.delete('gmail_error');
      window.history.replaceState({}, '', clean.toString());
    } else if (isGmailConnected()) {
      setConnected(true);
      setUserEmail(getGmailUserEmail() || '');
    }
  }, []);

  // ── Load inbox when connected ─────────────────────────────────────────────
  const loadInbox = useCallback(async () => {
    if (!isGmailConnected()) return;
    setIsLoadingInbox(true);
    setInboxError('');
    try {
      const msgs = await fetchInboxMessages(15);
      setMessages(msgs);
      setCountdown(POLL_INTERVAL);
    } catch (err: any) {
      if (err?.message?.includes('401') || err?.message?.includes('Not authenticated')) {
        clearGmailToken();
        setConnected(false);
        setMessages([]);
        setInboxError('Session expired. Please reconnect Gmail.');
      } else {
        setInboxError(err?.message || 'Failed to load inbox.');
      }
    } finally {
      setIsLoadingInbox(false);
    }
  }, []);

  // ── Auto-refresh every POLL_INTERVAL seconds ──────────────────────────────
  useEffect(() => {
    if (!connected) return;
    loadInbox();

    pollTimer.current = setInterval(loadInbox, POLL_INTERVAL * 1000);
    countdownTimer.current = setInterval(() => {
      setCountdown((c) => (c <= 1 ? POLL_INTERVAL : c - 1));
    }, 1000);

    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, [connected, loadInbox]);

  // ── Auto-scroll log ───────────────────────────────────────────────────────
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [streamLog]);

  // ── Stream-analyze a Gmail message ────────────────────────────────────────
  const analyzeMessage = async (msg: GmailMessage) => {
    if (analyzingId) return;
    setAnalyzingId(msg.id);
    setStreamLog([]);
    setStreamResult(null);

    try {
      // Fetch raw EML content from Gmail API
      setStreamLog(['📥 Fetching raw RFC-822 email content from Gmail...']);
      const emlContent = await fetchRawEml(msg.id);

      setStreamLog((prev) => [...prev, '🔗 Connected to AEGIS-TRACE forensic stream...']);

      // POST to SSE streaming endpoint
      const response = await fetch('/api/evidence/analyze-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emlContent,
          caseId: getUserCaseId(),
          filename: `gmail_${msg.id}.eml`,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Stream error: ${response.status}`);
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
              setStreamResult(event.data);
              // Also persist to case state via client-side engine
              await ingestAndAnalyzeEml(emlContent, getUserCaseId(), `gmail_${msg.id}.eml`);
              // Store result for badge display
              setAnalyzedResults((prev) => {
                const next = new Map(prev);
                next.set(msg.id, {
                  messageId: msg.id,
                  riskScore: event.data.riskScore,
                  severity: event.data.severity,
                  verdict: event.data.verdict,
                  spfStatus: event.data.spfStatus,
                  dkimStatus: event.data.dkimStatus,
                  dmarcStatus: event.data.dmarcStatus,
                });
                return next;
              });
              if (onEmailAnalyzed) onEmailAnalyzed();
            } else if (event.type === 'error') {
              setStreamLog((prev) => [...prev, `❌ Error: ${event.message}`]);
            }
          } catch {
            // skip malformed event
          }
        }
      }
    } catch (err: any) {
      setStreamLog((prev) => [...prev, `❌ ${err?.message || 'Analysis failed'}`]);
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleDisconnect = () => {
    clearGmailToken();
    setConnected(false);
    setMessages([]);
    setUserEmail('');
    setStreamLog([]);
    setStreamResult(null);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffHrs = diffMs / 3_600_000;
      if (diffHrs < 1) return `${Math.floor(diffMs / 60000)}m ago`;
      if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const severityColor = (severity: string) => {
    if (severity === 'CRITICAL') return 'text-error bg-error-container/30 border-error/30';
    if (severity === 'HIGH') return 'text-error bg-error-container/20 border-error/20';
    if (severity === 'MEDIUM') return 'text-secondary bg-secondary-container/30 border-secondary/30';
    return 'text-tertiary bg-tertiary/10 border-tertiary/20';
  };

  // ── NOT CONNECTED ─────────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div className="flex flex-col bg-surface-container rounded-2xl border border-outline-variant/20 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 bg-surface-container-high/60 border-b border-outline-variant/15">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
            <span className="material-symbols-outlined text-lg">inbox</span>
          </div>
          <div>
            <span className="font-headline-sm text-sm font-bold text-on-surface block">
              Gmail Live Inbox Stream
            </span>
            <span className="font-label-sm text-[11px] text-on-surface-variant">
              Connect your inbox to auto-detect and analyze phishing emails in real-time
            </span>
          </div>
        </div>

        {/* Connect CTA */}
        <div className="flex flex-col items-center justify-center py-12 px-6 gap-6 text-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-primary/20 shadow-xl">
              <span className="material-symbols-outlined text-4xl text-primary">mail</span>
            </div>
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-error rounded-full border-2 border-surface-container flex items-center justify-center">
              <span className="material-symbols-outlined text-on-error" style={{ fontSize: '12px' }}>wifi_tethering</span>
            </span>
          </div>

          <div>
            <h3 className="font-headline-sm text-lg font-bold text-on-surface">
              Connect Gmail Inbox
            </h3>
            <p className="text-sm text-on-surface-variant max-w-sm mt-1">
              Securely connect your Gmail account. AEGIS-TRACE will monitor your inbox and let you run one-click forensic analysis on any email — no manual export required.
            </p>
          </div>

          {inboxError && (
            <div className="px-4 py-2 rounded-lg bg-error-container/30 border border-error/30 text-error text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              <span>{inboxError}</span>
            </div>
          )}

          <button
            onClick={initiateGmailOAuth}
            className="flex items-center gap-3 px-6 py-3 rounded-xl bg-white text-gray-700 border border-gray-200 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all font-semibold text-sm"
          >
            {/* Google "G" logo */}
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            <span>Connect with Google</span>
            <span className="material-symbols-outlined text-sm text-gray-400">arrow_forward</span>
          </button>

          <p className="text-[11px] text-on-surface-variant max-w-xs">
            🔒 Read-only access. AEGIS-TRACE never sends, modifies, or stores your emails externally.
          </p>
        </div>
      </div>
    );
  }

  // ── CONNECTED ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-surface-container rounded-2xl border border-outline-variant/20 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-surface-container-high/60 border-b border-outline-variant/15">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-tertiary/10 text-tertiary flex items-center justify-center border border-tertiary/20">
            <span className="material-symbols-outlined text-lg">inbox</span>
          </div>
          <div>
            <span className="font-headline-sm text-sm font-bold text-on-surface flex items-center gap-2">
              Gmail Live Inbox
              <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
            </span>
            <span className="font-label-sm text-[11px] text-on-surface-variant">{userEmail}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-refresh countdown */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-container border border-outline-variant/20 text-xs text-on-surface-variant font-code-sm">
            <span className="material-symbols-outlined text-sm text-primary">refresh</span>
            <span>Refreshes in <strong className="text-on-surface">{countdown}s</strong></span>
          </div>

          <button
            onClick={loadInbox}
            disabled={isLoadingInbox}
            className="px-3 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-semibold flex items-center gap-1 transition-all"
          >
            <span className={`material-symbols-outlined text-sm ${isLoadingInbox ? 'animate-spin' : ''}`}>refresh</span>
            {isLoadingInbox ? 'Syncing...' : 'Sync Now'}
          </button>

          <button
            onClick={handleDisconnect}
            className="px-3 py-1 rounded-lg bg-surface-container hover:bg-error-container/20 text-on-surface-variant hover:text-error border border-outline-variant/20 text-xs font-semibold transition-all"
          >
            Disconnect
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row min-h-0">
        {/* ── Message List ───────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 overflow-y-auto max-h-[480px] divide-y divide-outline-variant/10">
          {inboxError && (
            <div className="px-6 py-3 bg-error-container/20 text-error text-xs font-semibold flex items-center gap-2 border-b border-error/20">
              <span className="material-symbols-outlined text-sm">error</span>
              {inboxError}
            </div>
          )}

          {isLoadingInbox && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <span className="text-xs text-on-surface-variant">Loading inbox...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-3xl">inbox</span>
              <span className="text-sm">No messages found in inbox</span>
            </div>
          ) : (
            messages.map((msg) => {
              const result = analyzedResults.get(msg.id);
              const isAnalyzing = analyzingId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 px-5 py-3.5 hover:bg-surface-container-high/40 transition-all group cursor-pointer ${
                    msg.isUnread ? 'bg-primary/[0.03] border-l-2 border-primary' : ''
                  }`}
                  onClick={() => !analyzingId && analyzeMessage(msg)}
                >
                  {/* Unread dot */}
                  <div className="flex-shrink-0 mt-1.5">
                    {msg.isUnread ? (
                      <span className="w-2 h-2 rounded-full bg-primary block" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-transparent block" />
                    )}
                  </div>

                  {/* Message content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={`text-xs font-semibold truncate ${msg.isUnread ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                        {msg.fromAddress || msg.from}
                      </span>
                      <span className="text-[10px] text-outline flex-shrink-0 font-code-sm">
                        {formatDate(msg.date)}
                      </span>
                    </div>
                    <div className="text-xs text-on-surface truncate font-medium mb-0.5">
                      {msg.subject}
                    </div>
                    <div className="text-[11px] text-on-surface-variant truncate">
                      {msg.snippet}
                    </div>
                  </div>

                  {/* Right actions */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    {result ? (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${severityColor(result.severity)}`}>
                        {result.riskScore}% {result.severity}
                      </span>
                    ) : isAnalyzing ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        Streaming...
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-container text-on-surface-variant border border-outline-variant/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>biotech</span>
                        Analyze
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Live Stream Log Panel ──────────────────────────────────────── */}
        {(streamLog.length > 0 || streamResult) && (
          <div className="w-full lg:w-80 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-outline-variant/15 bg-surface-container-low flex flex-col">
            {/* Log header */}
            <div className="px-4 py-3 border-b border-outline-variant/15 flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wider font-code-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-sm">terminal</span>
                Forensic Stream
              </span>
              {analyzingId && (
                <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
              )}
            </div>

            {/* Log lines */}
            <div
              ref={logRef}
              className="flex-1 overflow-y-auto p-4 space-y-1.5 max-h-56 lg:max-h-80 font-code-sm text-[11px]"
            >
              {streamLog.map((line, i) => (
                <div key={i} className="flex items-start gap-1.5 text-on-surface-variant">
                  <span className="text-outline font-mono flex-shrink-0 mt-0.5">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={i === streamLog.length - 1 ? 'text-primary' : ''}>{line}</span>
                </div>
              ))}
              {analyzingId && (
                <div className="flex items-center gap-1.5 text-primary">
                  <span className="text-outline font-mono">··</span>
                  <span className="animate-pulse">▊</span>
                </div>
              )}
            </div>

            {/* Result card */}
            {streamResult && (
              <div className={`mx-4 mb-4 p-3 rounded-xl border ${severityColor(streamResult.severity)}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Analysis Complete</span>
                  <span className="text-lg font-black font-mono">{streamResult.riskScore}%</span>
                </div>
                <div className="text-[11px] font-semibold mb-1">{streamResult.verdict}</div>
                <div className="flex gap-1 flex-wrap mt-2">
                  {['SPF', 'DKIM', 'DMARC'].map((proto, i) => {
                    const val = [streamResult.spfStatus, streamResult.dkimStatus, streamResult.dmarcStatus][i];
                    const pass = val === 'Passed';
                    return (
                      <span
                        key={proto}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                          pass
                            ? 'bg-tertiary/10 text-tertiary border-tertiary/20'
                            : 'bg-error-container/30 text-error border-error/20'
                        }`}
                      >
                        {proto}: {pass ? '✓' : '✗'}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
