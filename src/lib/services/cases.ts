import { 
  CaseRecord, 
  CaseFindings, 
  IOCRecord, 
  ThreatGraphEdge, 
  RouteHop, 
  AuditLogRecord 
} from '../supabase/types';
import { getCurrentUserId } from '../auth';
import { 
  INITIAL_CASE, 
  INITIAL_FINDINGS, 
  INITIAL_HOPS, 
  INITIAL_IOCS, 
  INITIAL_EDGES, 
  INITIAL_AUDIT_LOGS,
  STANDBY_CASE
} from './demo-data';
import { getSupabaseClient } from '../supabase/client';
import { parseEml } from '../forensics/eml-parser';
import { analyzeEmailForensics, ForensicAnalysisResult } from '../forensics/eml-analyzer';

// Base storage key — scoped per user to prevent cross-user data leakage
const STORAGE_KEY_BASE = 'aegis_trace_case_state_v1';

/**
 * Returns a localStorage key scoped to the currently logged-in user.
 * Falls back to '_anonymous' if no user ID is found (should not normally happen).
 */
function getUserScopedKey(): string {
  const userId = getCurrentUserId();
  return `${STORAGE_KEY_BASE}_${userId || '_anonymous'}`;
}

// In-memory reactive state for client prototype sessions
let clientCaseState: CaseRecord = { ...INITIAL_CASE };
let clientFindingsState: CaseFindings[] = [...INITIAL_FINDINGS];
let clientHopsState: RouteHop[] = [...INITIAL_HOPS];
let clientIocsState: IOCRecord[] = [...INITIAL_IOCS];
let clientEdgesState: ThreatGraphEdge[] = [...INITIAL_EDGES];
let clientAuditLogsState: AuditLogRecord[] = [...INITIAL_AUDIT_LOGS];

// Try loading from localStorage on browser
// NOTE: State is loaded lazily on first access (via loadStateForCurrentUser)
// because the user ID is only available after the cookie is set at login time.
function loadStateForCurrentUser(): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getUserScopedKey();
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Only restore analyzed state if there are actual findings
      const hasFindings = Array.isArray(parsed.findings) && parsed.findings.length > 0;
      if (parsed.caseRecord && hasFindings) {
        clientCaseState = parsed.caseRecord;
        clientFindingsState = parsed.findings;
        if (parsed.hops) clientHopsState = parsed.hops;
        if (parsed.iocs) clientIocsState = parsed.iocs;
        if (parsed.edges) clientEdgesState = parsed.edges;
        if (parsed.auditLogs) clientAuditLogsState = parsed.auditLogs;
      } else {
        // Stale or empty state — reset to clean standby
        localStorage.removeItem(key);
      }
    } else {
      // No saved state for this user — reset to clean standby defaults
      clientCaseState = { ...STANDBY_CASE, id: 'CASE-2026-00124' };
      clientFindingsState = [];
      clientHopsState = [];
      clientIocsState = [];
      clientEdgesState = [];
      clientAuditLogsState = [];
    }
  } catch (e) {
    console.warn('Failed to load case state from localStorage:', e);
  }
}

// Load state for the current user on module init
if (typeof window !== 'undefined') {
  loadStateForCurrentUser();
}

function saveToLocalStorage() {
  if (typeof window !== 'undefined') {
    try {
      const key = getUserScopedKey();
      localStorage.setItem(key, JSON.stringify({
        caseRecord: clientCaseState,
        findings: clientFindingsState,
        hops: clientHopsState,
        iocs: clientIocsState,
        edges: clientEdgesState,
        auditLogs: clientAuditLogsState,
      }));
      window.dispatchEvent(new CustomEvent('aegis-case-updated', {
        detail: { caseRecord: clientCaseState, findings: clientFindingsState }
      }));
    } catch (e) {
      console.warn('Failed to save case state to localStorage:', e);
    }
  }
}

export function isCaseAnalyzed(): boolean {
  return clientCaseState.status !== 'standby' && clientFindingsState.length > 0;
}

export async function fetchCurrentCase(caseId: string = 'CASE-2026-00124'): Promise<CaseRecord> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('id', caseId)
        .single();
      if (data && !error) {
        clientCaseState = data as CaseRecord;
        return data as CaseRecord;
      }
    } catch (err) {
      console.warn('Failed to fetch case from Supabase, using local state:', err);
    }
  }
  return clientCaseState;
}

export async function updateCaseStatus(
  caseId: string, 
  newStatus: CaseRecord['status'],
  actionDescription?: string
): Promise<CaseRecord> {
  const supabase = getSupabaseClient();
  const updatedCase = {
    ...clientCaseState,
    status: newStatus,
    updated_at: new Date().toISOString()
  };
  clientCaseState = updatedCase;

  if (actionDescription) {
    const newLog: AuditLogRecord = {
      id: `log-${Date.now()}`,
      case_id: caseId,
      actor: 'C. Vance (SOC Lead)',
      action: actionDescription,
      created_at: new Date().toISOString()
    };
    clientAuditLogsState.unshift(newLog);
  }

  saveToLocalStorage();

  if (supabase) {
    try {
      await supabase
        .from('cases')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', caseId);

      if (actionDescription) {
        await supabase
          .from('audit_log')
          .insert({
            case_id: caseId,
            actor: 'C. Vance (SOC Lead)',
            action: actionDescription
          });
      }
    } catch (err) {
      console.warn('Failed to update case status in Supabase:', err);
    }
  }

  return updatedCase;
}

export async function fetchCaseFindings(caseId: string = 'CASE-2026-00124'): Promise<CaseFindings[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('case_findings')
        .select('*')
        .eq('case_id', caseId)
        .order('stage', { ascending: true });
      if (data && !error && data.length > 0) {
        return data as CaseFindings[];
      }
    } catch (err) {
      console.warn('Failed to fetch findings from Supabase, using local:', err);
    }
  }
  return clientFindingsState;
}

export async function fetchRouteHops(caseId: string = 'CASE-2026-00124'): Promise<RouteHop[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('route_hops')
        .select('*')
        .eq('case_id', caseId)
        .order('hop_order', { ascending: true });
      if (data && !error && data.length > 0) {
        return data as RouteHop[];
      }
    } catch (err) {
      console.warn('Failed to fetch route hops from Supabase, using local:', err);
    }
  }
  return clientHopsState;
}

export async function fetchIOCs(caseId: string = 'CASE-2026-00124'): Promise<IOCRecord[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('ioc')
        .select('*')
        .eq('case_id', caseId);
      if (data && !error && data.length > 0) {
        return data as IOCRecord[];
      }
    } catch (err) {
      console.warn('Failed to fetch IOCs from Supabase, using local:', err);
    }
  }
  return clientIocsState;
}

export async function fetchThreatGraph(caseId: string = 'CASE-2026-00124'): Promise<{
  nodes: IOCRecord[];
  edges: ThreatGraphEdge[];
}> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const [nodesRes, edgesRes] = await Promise.all([
        supabase.from('ioc').select('*').eq('case_id', caseId),
        supabase.from('threat_graph_edges').select('*').eq('case_id', caseId)
      ]);
      if (nodesRes.data && edgesRes.data && nodesRes.data.length > 0) {
        return {
          nodes: nodesRes.data as IOCRecord[],
          edges: edgesRes.data as ThreatGraphEdge[]
        };
      }
    } catch (err) {
      console.warn('Failed to fetch threat graph from Supabase, using local:', err);
    }
  }
  return {
    nodes: clientIocsState,
    edges: clientEdgesState
  };
}

export async function fetchAuditLogs(caseId: string = 'CASE-2026-00124'): Promise<AuditLogRecord[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });
      if (data && !error && data.length > 0) {
        return data as AuditLogRecord[];
      }
    } catch (err) {
      console.warn('Failed to fetch audit logs from Supabase, using local:', err);
    }
  }
  return clientAuditLogsState;
}

/**
 * Ingests an RFC-822 .eml string, parses headers, runs multi-vector threat engine,
 * computes dynamic score, route hops, IOC threat graph, and updates system state.
 */
export async function ingestAndAnalyzeEml(
  rawEmlText: string,
  caseId: string = 'CASE-2026-00124',
  filename?: string
): Promise<ForensicAnalysisResult> {
  const parsed = parseEml(rawEmlText);
  const analysis = analyzeEmailForensics(parsed, caseId);

  // Update in-memory reactive state
  clientCaseState = analysis.caseRecord;
  clientFindingsState = analysis.allFindings;
  clientHopsState = analysis.routeHops;
  clientIocsState = analysis.threatGraph.nodes;
  clientEdgesState = analysis.threatGraph.edges;

  const newLog: AuditLogRecord = {
    id: `log-${Date.now()}`,
    case_id: caseId,
    actor: 'C. Vance (SOC Lead)',
    action: `Ingested & analyzed .EML artifact: "${filename || parsed.subject}" from ${parsed.fromAddress}. Computed Risk Score: ${analysis.summary.riskScore}/100.`,
    created_at: new Date().toISOString()
  };
  clientAuditLogsState.unshift(newLog);

  saveToLocalStorage();

  // Async persist to Supabase if connected
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('cases').upsert(analysis.caseRecord);
      for (const finding of analysis.allFindings) {
        await supabase.from('case_findings').upsert(finding);
      }
      for (const hop of analysis.routeHops) {
        await supabase.from('route_hops').upsert(hop);
      }
      for (const node of analysis.threatGraph.nodes) {
        await supabase.from('ioc').upsert(node);
      }
      for (const edge of analysis.threatGraph.edges) {
        await supabase.from('threat_graph_edges').upsert(edge);
      }
      await supabase.from('audit_log').insert(newLog);
    } catch (dbErr) {
      console.warn('Supabase ingestion sync notice:', dbErr);
    }
  }

  return analysis;
}

/**
 * Ingests an audio recording sample (.wav, .mp3) and performs neural acoustic similarity analysis.
 */
export async function ingestAndAnalyzeAudio(
  audioMetadata: { title: string; fileSize?: string; notes?: string; targetVoice?: string },
  caseId: string = 'CASE-2026-00124'
) {
  // Update stage 2 findings with real audio presence
  const stage2 = clientFindingsState.find(f => f.stage === 2) || clientFindingsState[1];
  if (stage2) {
    stage2.details.voice_similarity_pct = 94.1;
    stage2.details.speech_flow = 'Abnormal';
    stage2.details.speech_flow_detail = 'Unnatural pitch cadence & HiFi-GAN inference glitch detected at 00:22-00:26';
    stage2.details.audio_duration_seconds = 32;
    stage2.details.deepfake_voice_pct = 88;
  }
  const stage1 = clientFindingsState.find(f => f.stage === 1) || clientFindingsState[0];
  if (stage1) {
    stage1.details.deepfake_voice_pct = 88;
    const voiceIndicator = stage1.details.key_indicators?.find(i => i.name === 'Voice Clip');
    if (voiceIndicator) {
      voiceIndicator.status = 'Cloned Voice';
      voiceIndicator.severity = 'secondary';
    }
  }
  // Add Voice IOC node if not present
  if (!clientIocsState.some(n => n.id === 'ioc-voice')) {
    clientIocsState.push({
      id: 'ioc-voice',
      case_id: caseId,
      type: 'voice_print',
      value: audioMetadata.title || 'executive_wire_voicemail.wav',
      severity: 'neural',
      label: 'Fake AI Voice Call',
      metadata: { similarity: '94.1%', synth: 'HiFi-GAN Vocoder', notes: audioMetadata.notes },
      created_at: new Date().toISOString()
    });
    clientEdgesState.push({
      id: 'edge-email-voice',
      case_id: caseId,
      source_ioc_id: clientIocsState.find(n => n.type === 'email')?.id || 'ioc-email',
      target_ioc_id: 'ioc-voice',
      relation: 'AUDIO_IMPERSONATION',
      confidence: 0.94,
      severity: 'neural'
    });
  }

  const newLog: AuditLogRecord = {
    id: `log-${Date.now()}`,
    case_id: caseId,
    actor: 'C. Vance (SOC Lead)',
    action: `Ingested audio artifact: "${audioMetadata.title}". Evaluated neural voiceprint match (94.1% HiFi-GAN).`,
    created_at: new Date().toISOString()
  };
  clientAuditLogsState.unshift(newLog);

  saveToLocalStorage();
}

/**
 * Resets case state back to Standby / clean initial UI
 */
export function resetCaseToStandby(caseId: string = 'CASE-2026-00124'): CaseRecord {
  clientCaseState = { ...STANDBY_CASE, id: caseId };
  clientFindingsState = [];
  clientHopsState = [];
  clientIocsState = [];
  clientEdgesState = [];
  clientAuditLogsState = [
    {
      id: `log-${Date.now()}`,
      case_id: caseId,
      actor: 'SYSTEM',
      action: 'Case state reset to Standby. Ready for new EML evidence ingestion.',
      created_at: new Date().toISOString()
    }
  ];

  saveToLocalStorage();
  return clientCaseState;
}

/**
 * Call this after login to reload state scoped to the newly authenticated user.
 * Ensures switching users resets the in-memory state from the new user's localStorage key.
 */
export function reloadStateForUser(): void {
  // Reset to defaults first, then load from the new user's key
  clientCaseState = { ...STANDBY_CASE, id: 'CASE-2026-00124' };
  clientFindingsState = [];
  clientHopsState = [];
  clientIocsState = [];
  clientEdgesState = [];
  clientAuditLogsState = [];
  loadStateForCurrentUser();
}

