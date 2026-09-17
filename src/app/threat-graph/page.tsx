'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ThreatGraphCanvas } from '@/components/graph/ThreatGraphCanvas';
import { fetchThreatGraph, fetchCurrentCase } from '@/lib/services/cases';
import { IOCRecord, ThreatGraphEdge, CaseRecord } from '@/lib/supabase/types';
import { getUserCaseId } from '@/lib/auth';

export default function ThreatGraphPage() {
  const [caseData, setCaseData] = useState<CaseRecord | null>(null);
  const [graphData, setGraphData] = useState<{ nodes: IOCRecord[]; edges: ThreatGraphEdge[] }>({
    nodes: [],
    edges: [],
  });
  const [selectedNode, setSelectedNode] = useState<IOCRecord | null>(null);

  const loadData = async () => {
    const caseId = getUserCaseId();
    const c = await fetchCurrentCase(caseId);
    const g = await fetchThreatGraph(caseId);
    setCaseData(c);
    setGraphData(g);
    if (g.nodes.length > 0) {
      setSelectedNode(g.nodes[2] || g.nodes[0]);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('aegis-case-updated', loadData);
    return () => window.removeEventListener('aegis-case-updated', loadData);
  }, []);

  const isAnalyzed = caseData?.status !== 'standby' && graphData.nodes.length > 0;

  return (
    <div className="flex flex-col w-full pb-space-xl">
      {/* Top Header & Breadcrumb Strip */}
      <section className="flex flex-col gap-space-md mb-space-lg">
        <div className="flex flex-wrap items-center justify-between gap-space-md">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-md">
              <div className="flex items-center gap-space-xs px-space-sm py-0.5 rounded bg-surface-container-high text-secondary border border-secondary/30">
                <span className="material-symbols-outlined text-xs">hub</span>
                <span className="font-code-sm text-code-sm font-semibold tracking-wider uppercase">
                  Threat Map
                </span>
              </div>
              <span className="font-headline-md text-headline-md text-on-surface font-bold">
                Threat Map &amp; Connections
              </span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Visualizing multi-vector correlation between the attacker, spoofed email, fake voice, and target organization.
            </p>
          </div>

          <div className="flex items-center gap-space-sm">
            <Link
              href="/geolocation-threat-infrastructure"
              className="px-space-md py-space-sm rounded-lg bg-primary text-on-primary hover:bg-primary-container font-body-sm text-body-sm font-semibold transition-all shadow-md flex items-center gap-1.5"
            >
              <span>Next: Geolocation Map →</span>
              <span className="material-symbols-outlined text-sm">public</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Main Interactive Graph Canvas & Inspector */}
      <ThreatGraphCanvas
        nodes={graphData.nodes}
        edges={graphData.edges}
        onSelectNode={(node) => setSelectedNode(node)}
      />
    </div>
  );
}
