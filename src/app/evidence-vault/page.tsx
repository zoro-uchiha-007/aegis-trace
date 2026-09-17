'use client';

import React, { useEffect, useState, useRef } from 'react';
import { fetchCurrentCase, fetchIOCs, fetchAuditLogs, isCaseAnalyzed } from '@/lib/services/cases';
import { IOCRecord, AuditLogRecord, CaseRecord } from '@/lib/supabase/types';
import { getUserCaseId } from '@/lib/auth';

interface VaultItem {
  id: string;
  type: 'email' | 'audio' | 'attachment' | 'ioc' | 'report';
  label: string;
  filename: string;
  size: string;
  hash?: string;
  uploadedAt: string;
  severity: 'critical' | 'neural' | 'suspicious' | 'verified' | 'info';
  metadata?: Record<string, any>;
}

function severityStyle(severity: string) {
  switch (severity) {
    case 'critical': return 'text-error border-error/30 bg-error-container/20';
    case 'neural': return 'text-secondary border-secondary/30 bg-secondary-container/20';
    case 'suspicious': return 'text-tertiary border-tertiary/30 bg-tertiary-container/20';
    case 'verified': return 'text-primary border-primary/30 bg-primary/10';
    default: return 'text-on-surface-variant border-outline-variant/30 bg-surface-container-high';
  }
}

function severityIcon(type: string) {
  switch (type) {
    case 'email': return 'mail';
    case 'audio': return 'graphic_eq';
    case 'attachment': return 'attach_file';
    case 'ioc': return 'bug_report';
    case 'report': return 'description';
    default: return 'folder';
  }
}

export default function EvidenceVaultPage() {
  const [caseData, setCaseData] = useState<CaseRecord | null>(null);
  const [iocs, setIocs] = useState<IOCRecord[]>([]);
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'email' | 'audio' | 'attachment' | 'ioc'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);

  const loadData = async () => {
    const caseId = getUserCaseId();
    const [c, iocList, logList] = await Promise.all([
      fetchCurrentCase(caseId),
      fetchIOCs(caseId),
      fetchAuditLogs(caseId),
    ]);
    setCaseData(c);
    setIocs(iocList);
    setLogs(logList);
    setAnalyzed(isCaseAnalyzed());

    // Build vault items from IOCs and logs
    const items: VaultItem[] = iocList.map((ioc) => ({
      id: ioc.id,
      type: ioc.type === 'voice_print' ? 'audio' : ioc.type === 'hash' ? 'attachment' : 'ioc',
      label: ioc.label || ioc.value,
      filename: ioc.value,
      size: ioc.metadata?.payload_size || ioc.metadata?.fileSize || '—',
      hash: ioc.type === 'hash' ? ioc.value : undefined,
      uploadedAt: ioc.created_at,
      severity: ioc.severity as VaultItem['severity'],
      metadata: ioc.metadata,
    }));

    // Add email artifact from logs if present
    const emlLog = logList.find((l) => l.action.toLowerCase().includes('.eml') || l.action.toLowerCase().includes('ingested'));
    if (emlLog && iocList.some((i) => i.type === 'email')) {
      const existing = items.find((i) => i.type === 'ioc' && i.filename.includes('@'));
      if (!existing) {
        items.unshift({
          id: 'vault-eml',
          type: 'email',
          label: 'Ingested Email Artifact (.EML)',
          filename: 'phishing_email_artifact.eml',
          size: '12 KB',
          uploadedAt: emlLog.created_at,
          severity: 'critical',
          metadata: { parsed_by: 'AEGIS RFC-822 Engine' },
        });
      }
    }

    setVaultItems(items);
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('aegis-case-updated', handleUpdate);
    return () => window.removeEventListener('aegis-case-updated', handleUpdate);
  }, []);

  const filtered = vaultItems.filter((item) => {
    const matchFilter = filter === 'all' || item.type === filter;
    const matchSearch =
      !searchQuery ||
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.filename.toLowerCase().includes(searchQuery.toLowerCase());
    return matchFilter && matchSearch;
  });

  const typeCounts = {
    all: vaultItems.length,
    email: vaultItems.filter((i) => i.type === 'email').length,
    audio: vaultItems.filter((i) => i.type === 'audio').length,
    attachment: vaultItems.filter((i) => i.type === 'attachment').length,
    ioc: vaultItems.filter((i) => i.type === 'ioc').length,
  };

  return (
    <div className="flex flex-col w-full pb-12 gap-space-lg">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-space-lg bg-surface-container-low rounded-xl shadow-md border border-outline-variant/15">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded font-mono text-xs font-bold uppercase bg-primary/10 text-primary">
              Evidence Vault
            </span>
            <span className="text-on-surface-variant text-xs">
              • Case {caseData?.id || 'CASE-2026-00124'} • Immutable Chain of Custody
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold">
            Forensic Evidence Vault
          </h1>
          <p className="font-body-md text-on-surface-variant text-sm">
            Cryptographically sealed repository of all ingested artifacts, IOCs, and forensic evidence items.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border ${
            analyzed ? 'bg-error-container/20 text-error border-error/20' : 'bg-surface-container text-on-surface-variant border-outline-variant/20'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${analyzed ? 'bg-error animate-ping' : 'bg-outline'}`} />
            <span>{analyzed ? `${vaultItems.length} Items Secured` : 'Vault Empty — Awaiting Ingestion'}</span>
          </div>
        </div>
      </div>

      {!analyzed ? (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center py-20 bg-surface-container rounded-xl border border-outline-variant/15 border-dashed gap-6">
          <div className="w-20 h-20 rounded-2xl bg-surface-container-high border border-outline-variant/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-outline">lock</span>
          </div>
          <div className="text-center max-w-sm">
            <h2 className="font-headline-sm text-base font-bold text-on-surface mb-1">
              No Evidence Collected Yet
            </h2>
            <p className="text-sm text-on-surface-variant">
              Upload an <code className="font-mono text-primary font-bold">.EML</code> file on the dashboard or Stage 1 Triage to begin analysis and populate the Evidence Vault.
            </p>
          </div>
          <a
            href="/stage-1-fast-triage"
            className="px-5 py-2.5 rounded-lg bg-primary text-on-primary font-semibold text-sm flex items-center gap-2 shadow-lg hover:bg-primary-container transition-all"
          >
            <span className="material-symbols-outlined text-base">bolt</span>
            <span>Go to Stage 1 Triage</span>
          </a>
        </div>
      ) : (
        <>
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Email Artifacts', count: typeCounts.email, icon: 'mail', color: 'text-primary' },
              { label: 'Audio / Voice', count: typeCounts.audio, icon: 'graphic_eq', color: 'text-secondary' },
              { label: 'Attachments', count: typeCounts.attachment, icon: 'attach_file', color: 'text-error' },
              { label: 'IOC Records', count: typeCounts.ioc, icon: 'bug_report', color: 'text-tertiary' },
            ].map((stat) => (
              <div key={stat.label} className="bg-surface-container rounded-xl p-4 border border-outline-variant/15 flex items-center gap-3">
                <span className={`material-symbols-outlined text-2xl ${stat.color}`}>{stat.icon}</span>
                <div>
                  <div className="font-bold text-lg text-on-surface">{stat.count}</div>
                  <div className="text-xs text-on-surface-variant">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-surface-container-low rounded-lg p-1 border border-outline-variant/20">
              {(['all', 'email', 'audio', 'attachment', 'ioc'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all capitalize flex items-center gap-1 ${
                    filter === f
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {f === 'all' ? 'All Items' : f.charAt(0).toUpperCase() + f.slice(1)}
                  <span className="px-1 py-0.5 rounded text-[10px] font-mono bg-surface-container/50">
                    {typeCounts[f]}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex-1 min-w-40 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-base">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by label, filename, hash..."
                className="w-full bg-surface-container rounded-lg pl-9 pr-3 py-2 text-xs font-body-sm text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Evidence Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.length === 0 ? (
              <div className="col-span-full flex flex-col items-center py-12 text-on-surface-variant text-sm gap-2">
                <span className="material-symbols-outlined text-3xl text-outline">search_off</span>
                <span>No items match your filter or search query.</span>
              </div>
            ) : (
              filtered.map((item) => (
                <div
                  key={item.id}
                  className="bg-surface-container rounded-xl p-4 border border-outline-variant/15 hover:border-primary/30 transition-all shadow-sm flex flex-col gap-3 cursor-pointer group"
                  onClick={() => setSelectedItem(item)}
                >
                  {/* Item Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${severityStyle(item.severity)}`}>
                        <span className="material-symbols-outlined text-base">{severityIcon(item.type)}</span>
                      </div>
                      <div>
                        <span className={`text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded border ${severityStyle(item.severity)}`}>
                          {item.severity}
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-outline text-sm group-hover:text-primary transition-colors">open_in_new</span>
                  </div>

                  {/* Label & Filename */}
                  <div>
                    <h3 className="font-semibold text-sm text-on-surface leading-tight line-clamp-1">
                      {item.label}
                    </h3>
                    <p className="text-xs text-on-surface-variant font-mono mt-0.5 truncate">
                      {item.filename}
                    </p>
                  </div>

                  {/* Hash if present */}
                  {item.hash && (
                    <div className="bg-surface-container-low rounded p-2 border border-outline-variant/15">
                      <span className="text-[10px] text-outline uppercase font-semibold font-mono block mb-0.5">SHA-256</span>
                      <span className="font-mono text-[10px] text-on-surface break-all">{item.hash.substring(0, 40)}...</span>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between text-[10px] text-on-surface-variant pt-1 border-t border-outline-variant/10">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">schedule</span>
                      {new Date(item.uploadedAt).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="font-mono">{item.size}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Audit Trail */}
          <div className="bg-surface-container rounded-xl p-space-lg border border-outline-variant/15 shadow-sm">
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-outline-variant/15">
              <span className="material-symbols-outlined text-primary text-base">receipt_long</span>
              <h2 className="font-headline-sm text-base font-bold text-on-surface">Chain of Custody Audit Trail</h2>
              <span className="ml-auto font-mono text-xs text-on-surface-variant">{logs.length} Events</span>
            </div>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between text-xs border border-outline-variant/10"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-primary font-bold shrink-0">{log.actor}:</span>
                    <span className="text-on-surface truncate">{log.action}</span>
                  </div>
                  <span className="text-on-surface-variant font-mono text-[10px] shrink-0 ml-2">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="w-full max-w-lg bg-surface-container-low rounded-xl p-6 shadow-2xl border border-outline-variant/30 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${severityStyle(selectedItem.severity)}`}>
                  <span className="material-symbols-outlined">{severityIcon(selectedItem.type)}</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-on-surface">{selectedItem.label}</h3>
                  <span className={`text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded border ${severityStyle(selectedItem.severity)}`}>
                    {selectedItem.severity}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-outline hover:text-on-surface p-1 rounded-lg transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {[
                { key: 'Filename', val: selectedItem.filename },
                { key: 'Type', val: selectedItem.type.toUpperCase() },
                { key: 'Size', val: selectedItem.size },
                { key: 'Ingested At', val: new Date(selectedItem.uploadedAt).toLocaleString() },
                ...(selectedItem.hash ? [{ key: 'SHA-256 Hash', val: selectedItem.hash }] : []),
              ].map(({ key, val }) => (
                <div key={key} className="flex justify-between gap-3 p-2.5 bg-surface-container rounded-lg border border-outline-variant/15 text-xs">
                  <span className="font-semibold text-on-surface-variant uppercase tracking-wider">{key}</span>
                  <span className="font-mono text-on-surface break-all text-right">{val}</span>
                </div>
              ))}

              {selectedItem.metadata && Object.keys(selectedItem.metadata).length > 0 && (
                <div className="p-3 bg-surface-container rounded-lg border border-outline-variant/15">
                  <span className="text-[10px] uppercase font-semibold text-outline block mb-2">Metadata</span>
                  {Object.entries(selectedItem.metadata).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs py-0.5 border-b border-outline-variant/10 last:border-0">
                      <span className="text-on-surface-variant capitalize">{k.replace(/_/g, ' ')}</span>
                      <span className="font-mono text-on-surface">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface-variant hover:text-on-surface text-xs font-semibold transition-all"
              >
                Close
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 text-xs font-semibold transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Export to Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
