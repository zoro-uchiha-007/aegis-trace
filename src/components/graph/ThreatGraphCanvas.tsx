'use client';

import React, { useState } from 'react';
import { IOCRecord, ThreatGraphEdge } from '@/lib/supabase/types';
import { EmlIngestionDropzone } from '@/components/evidence/EmlIngestionDropzone';

interface ThreatGraphCanvasProps {
  nodes: IOCRecord[];
  edges: ThreatGraphEdge[];
  onSelectNode?: (node: IOCRecord | null) => void;
}

interface NodePosition {
  id: string;
  x: number;
  y: number;
  label: string;
  sublabel: string;
  type: string;
  severity: string;
  icon: string;
  tag: string;
}

// Fixed preset layout coordinates if standard node IDs match
const PRESET_COORDS: Record<string, Partial<NodePosition>> = {
  'ioc-adversary': { x: 440, y: 70, icon: 'person_alert', tag: 'ATTACKER' },
  'ioc-email': { x: 230, y: 190, icon: 'mail', tag: 'INITIAL LURE' },
  'ioc-voice': { x: 520, y: 270, icon: 'graphic_eq', tag: 'VOICE FRAUD' },
  'ioc-synth': { x: 720, y: 200, icon: 'neurology', tag: 'NEURAL INFERENCE' },
  'ioc-domain': { x: 680, y: 90, icon: 'public_off', tag: 'FAKE DOMAIN' },
  'ioc-origin-ip': { x: 740, y: 350, icon: 'alt_route', tag: 'ORIGIN IP' },
  'ioc-tor': { x: 770, y: 370, icon: 'alt_route', tag: 'PROXY RELAY' },
  'ioc-attachment': { x: 140, y: 360, icon: 'picture_as_pdf', tag: 'PAYLOAD' },
  'ioc-victim': { x: 370, y: 500, icon: 'shield_person', tag: 'TARGET VICTIM' },
};

function getNodeIcon(type: string): string {
  switch (type) {
    case 'actor': return 'person_alert';
    case 'email': return 'mail';
    case 'voice_print': return 'graphic_eq';
    case 'domain': return 'public_off';
    case 'ip': return 'router';
    case 'hash': return 'picture_as_pdf';
    case 'victim': return 'shield_person';
    default: return 'hub';
  }
}

function getNodeTag(type: string): string {
  switch (type) {
    case 'actor': return 'ATTACKER';
    case 'email': return 'EMAIL LURE';
    case 'voice_print': return 'VOICE CLONE';
    case 'domain': return 'DOMAIN';
    case 'ip': return 'NETWORK IP';
    case 'hash': return 'PAYLOAD';
    case 'victim': return 'TARGET';
    default: return 'IOC';
  }
}

function computeDynamicNodePositions(nodes: IOCRecord[]): Record<string, NodePosition> {
  const positions: Record<string, NodePosition> = {};
  
  // Categorize nodes for layered layout
  const actorsAndDomains = nodes.filter((n) => n.type === 'actor' || n.type === 'domain');
  const emailsAndVoices = nodes.filter((n) => n.type === 'email' || n.type === 'voice_print');
  const ipsAndPayloads = nodes.filter((n) => n.type === 'ip' || n.type === 'hash');
  const victims = nodes.filter((n) => n.type === 'victim');
  const others = nodes.filter((n) => !['actor', 'domain', 'email', 'voice_print', 'ip', 'hash', 'victim'].includes(n.type));

  const placeRow = (list: IOCRecord[], yCenter: number) => {
    const count = list.length;
    list.forEach((n, idx) => {
      const preset = PRESET_COORDS[n.id];
      const spacing = count > 1 ? 640 / (count + 1) : 440;
      const calcX = count > 1 ? 120 + (idx + 1) * spacing : 440;

      positions[n.id] = {
        id: n.id,
        x: preset?.x ?? calcX,
        y: preset?.y ?? yCenter,
        label: n.label || n.value,
        sublabel: n.value,
        type: n.type,
        severity: n.severity || 'critical',
        icon: preset?.icon ?? getNodeIcon(n.type),
        tag: preset?.tag ?? getNodeTag(n.type),
      };
    });
  };

  placeRow(actorsAndDomains, 80);
  placeRow(emailsAndVoices, 210);
  placeRow(ipsAndPayloads, 360);
  placeRow(victims, 510);
  placeRow(others, 280);

  return positions;
}

export const ThreatGraphCanvas: React.FC<ThreatGraphCanvasProps> = ({
  nodes,
  edges,
  onSelectNode,
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string>(nodes[0]?.id || 'ioc-email');
  const [zoom, setZoom] = useState<number>(1);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col gap-6 w-full">
        <div className="bg-surface-container rounded-2xl p-8 border border-outline-variant/20 shadow-md text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center mb-4 border border-secondary/20">
            <span className="material-symbols-outlined text-3xl">hub</span>
          </div>
          <h2 className="font-headline-sm text-xl font-bold text-on-surface">
            Threat Correlation Graph Standby
          </h2>
          <p className="text-sm text-on-surface-variant max-w-lg mt-1 mb-6">
            Upload an <code className="text-primary font-mono font-bold">.EML</code> file or load a test sample below to automatically map the attacker, spoofed domain, origin server, and target victim infrastructure.
          </p>

          <EmlIngestionDropzone className="w-full max-w-2xl text-left" />
        </div>
      </div>
    );
  }

  const nodePositions = computeDynamicNodePositions(nodes);

  const handleNodeClick = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    const nodeObj = nodes.find((n) => n.id === nodeId);
    if (onSelectNode) onSelectNode(nodeObj || null);
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];
  const selectedNodePos = nodePositions[selectedNodeId] || nodePositions[nodes[0]?.id];

  const filteredNodeKeys = Object.keys(nodePositions).filter((key) => {
    const node = nodePositions[key];
    if (activeFilter === 'all') return true;
    if (activeFilter === 'email') return node.type === 'email' || node.type === 'actor';
    if (activeFilter === 'voice') return node.type === 'voice_print';
    if (activeFilter === 'domain') return node.type === 'domain' || node.type === 'ip';
    if (activeFilter === 'victim') return node.type === 'victim';
    return true;
  });

  return (
    <div className="flex flex-col gap-space-md w-full">
      {/* Top Filter Buttons & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-space-md p-space-sm bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/15">
        <div className="flex flex-wrap items-center gap-space-xs">
          {[
            { id: 'all', label: `All (${nodes.length})` },
            { id: 'email', label: 'Email Lure' },
            { id: 'voice', label: 'Voice Call' },
            { id: 'domain', label: 'Domain & IP' },
            { id: 'victim', label: 'Target' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-space-md py-1 rounded text-label-sm font-label-sm tracking-wider uppercase transition-all ${
                activeFilter === f.id
                  ? 'bg-primary text-on-primary font-bold shadow-sm'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Zoom & Reset Toolbar */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface-container-low p-space-xs rounded-lg gap-space-xs border border-outline-variant/20">
            <button
              onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}
              title="Zoom In"
              className="p-space-xs rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-sm">zoom_in</span>
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}
              title="Zoom Out"
              className="p-space-xs rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-sm">zoom_out</span>
            </button>
            <button
              onClick={() => setZoom(1)}
              title="Reset View"
              className="p-space-xs rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-sm">filter_center_focus</span>
            </button>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-surface-container-low rounded-lg text-xs font-code-sm text-on-surface-variant">
            <span className="h-2 w-2 rounded-full bg-tertiary animate-pulse" />
            <span>GNN &amp; Neo4j Topology Correlation</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Visual Graph Canvas (8 Cols) + Node Inspector (4 Cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* Canvas Area */}
        <div className="xl:col-span-8 flex flex-col gap-space-md">
          <div
            className="relative w-full h-[620px] bg-surface-container-lowest rounded-xl overflow-hidden shadow-2xl border border-outline-variant/20 select-none"
            style={{
              backgroundImage:
                'radial-gradient(rgba(6, 182, 212, 0.15) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            {/* Center Ambient Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />

            {/* Scaled Canvas Container */}
            <div
              className="absolute inset-0 w-full h-full transition-transform duration-300 origin-center"
              style={{ transform: `scale(${zoom})` }}
            >
              {/* Dynamic SVG Link Edges */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 880 600"
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <linearGradient id="cyanToRed" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4cd7f6" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#ffb4ab" stopOpacity="0.8" />
                  </linearGradient>
                  <linearGradient id="purpleGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#d0bcff" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#571bc1" stopOpacity="0.7" />
                  </linearGradient>
                  <filter id="glowEdge" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Render Dynamic Edges from edges prop */}
                {edges.map((edge) => {
                  const src = nodePositions[edge.source_ioc_id];
                  const tgt = nodePositions[edge.target_ioc_id];
                  if (!src || !tgt) return null;

                  const midX = (src.x + tgt.x) / 2 + (src.x < tgt.x ? -30 : 30);
                  const midY = (src.y + tgt.y) / 2;
                  const isNeural = edge.severity === 'neural';

                  return (
                    <g key={edge.id}>
                      <path
                        d={`M ${src.x} ${src.y} Q ${midX} ${midY} ${tgt.x} ${tgt.y}`}
                        fill="none"
                        stroke={isNeural ? 'url(#purpleGlow)' : edge.severity === 'critical' ? '#ffb4ab' : '#4cd7f6'}
                        strokeWidth={isNeural ? '2.5' : '2'}
                        strokeDasharray={isNeural ? '5 3' : edge.severity === 'critical' ? '4 4' : 'none'}
                        filter={isNeural ? 'url(#glowEdge)' : undefined}
                        opacity="0.85"
                      />
                      <text
                        x={(src.x + tgt.x) / 2}
                        y={(src.y + tgt.y) / 2 - 6}
                        fill={isNeural ? '#d0bcff' : '#869397'}
                        fontFamily="JetBrains Mono, monospace"
                        fontSize="9"
                        fontWeight="600"
                        letterSpacing="0.5"
                        textAnchor="middle"
                      >
                        {edge.relation}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Interactive Nodes */}
              {filteredNodeKeys.map((nodeKey) => {
                const node = nodePositions[nodeKey];
                const isSelected = selectedNodeId === node.id;

                let ringColor = 'border-outline-variant/30';
                let tagColor = 'text-on-surface-variant';
                let iconBg = 'bg-surface-container-high text-primary';

                if (node.severity === 'critical') {
                  ringColor = isSelected ? 'ring-2 ring-error ring-offset-2 ring-offset-background' : 'border-error/30';
                  tagColor = 'text-error';
                  iconBg = 'bg-error-container text-error';
                } else if (node.severity === 'neural') {
                  ringColor = isSelected ? 'ring-2 ring-secondary ring-offset-2 ring-offset-background' : 'border-secondary/40';
                  tagColor = 'text-secondary';
                  iconBg = 'bg-secondary-container text-secondary';
                } else if (node.severity === 'verified') {
                  ringColor = isSelected ? 'ring-2 ring-tertiary ring-offset-2 ring-offset-background' : 'border-tertiary/40';
                  tagColor = 'text-tertiary';
                  iconBg = 'bg-tertiary-container text-tertiary';
                }

                return (
                  <div
                    key={node.id}
                    onClick={() => handleNodeClick(node.id)}
                    className={`absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 hover:scale-110 z-20 ${
                      isSelected ? 'scale-105 z-30' : ''
                    }`}
                    style={{ left: `${node.x}px`, top: `${node.y}px` }}
                  >
                    <div
                      className={`flex items-center gap-space-sm p-space-xs pr-space-md bg-surface-container-low rounded-xl shadow-xl border ${ringColor}`}
                    >
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${iconBg}`}>
                        <span className="material-symbols-outlined text-sm">{node.icon}</span>
                      </div>
                      <div className="flex flex-col text-left pr-1">
                        <div className="flex items-center gap-1">
                          <span className={`font-label-sm text-[10px] font-bold uppercase tracking-wider ${tagColor}`}>
                            {node.tag}
                          </span>
                        </div>
                        <span className="font-body-sm text-xs font-semibold text-on-surface whitespace-nowrap max-w-[180px] truncate">
                          {node.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Node Details Inspector Panel (4 Cols) */}
        <div className="xl:col-span-4 bg-surface-container-low rounded-xl p-space-lg shadow-xl border border-outline-variant/20 flex flex-col gap-space-md">
          <div className="flex items-center justify-between pb-space-sm border-b border-outline-variant/20">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-lg">info</span>
              <h3 className="font-headline-sm text-base text-on-surface font-semibold">
                IOC Node Inspector
              </h3>
            </div>
            <span className="font-code-sm text-xs px-2 py-0.5 rounded bg-surface-container text-primary font-bold">
              {selectedNodePos?.tag || 'INSPECTED'}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <span className="font-label-sm text-on-surface-variant uppercase text-[10px] tracking-wider block">
                Entity Value / Identifier
              </span>
              <div className="font-code-md text-sm font-semibold text-primary break-all bg-surface-container p-2 rounded mt-1 border border-outline-variant/15">
                {selectedNode?.value || selectedNodePos?.sublabel}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface-container p-2 rounded border border-outline-variant/15">
                <span className="font-label-sm text-on-surface-variant uppercase text-[10px]">Type</span>
                <div className="font-code-sm text-xs font-bold text-on-surface uppercase mt-0.5">
                  {selectedNode?.type || 'IOC'}
                </div>
              </div>
              <div className="bg-surface-container p-2 rounded border border-outline-variant/15">
                <span className="font-label-sm text-on-surface-variant uppercase text-[10px]">Severity</span>
                <div className={`font-code-sm text-xs font-bold uppercase mt-0.5 ${
                  selectedNode?.severity === 'verified' ? 'text-tertiary' : 'text-error'
                }`}>
                  {selectedNode?.severity || 'CRITICAL'}
                </div>
              </div>
            </div>

            {selectedNode?.metadata && (
              <div className="bg-surface-container p-3 rounded-lg border border-outline-variant/15 flex flex-col gap-2">
                <span className="font-label-sm text-on-surface-variant uppercase text-[10px] tracking-wider">
                  Telemetry Metadata
                </span>
                {Object.entries(selectedNode.metadata).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-xs font-code-sm">
                    <span className="text-on-surface-variant capitalize">{k.replace('_', ' ')}:</span>
                    <span className="text-on-surface font-semibold">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 bg-error-container/15 rounded-lg border border-error/30 flex items-start gap-2 text-xs">
              <span className="material-symbols-outlined text-error text-sm mt-0.5">warning</span>
              <p className="text-on-surface-variant leading-relaxed">
                Active correlation: Node correlated with multi-vector forensics chain for case investigation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
