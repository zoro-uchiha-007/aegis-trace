export type CaseStatus = 
  | 'standby'
  | 'triage'
  | 'deep_forensics'
  | 'threat_graph'
  | 'geolocation'
  | 'report_pending'
  | 'closed'
  | 'quarantined';

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CaseRecord {
  id: string; // e.g. 'CASE-2026-00124'
  title: string;
  description: string;
  status: CaseStatus;
  severity: SeverityLevel;
  risk_score: number;
  target_entity: string;
  attempted_amount: number;
  created_by?: string;
  assigned_to: string;
  created_at: string;
  updated_at: string;
}

export interface CaseEvidence {
  id: string;
  case_id: string;
  type: 'email' | 'audio' | 'attachment' | 'domain' | 'network' | 'telemetry';
  title: string;
  payload: Record<string, any>;
  uploaded_at: string;
}

export interface CaseFindings {
  id: string;
  case_id: string;
  stage: number;
  verdict: string;
  risk_score: number;
  details: {
    spf_status?: 'Passed' | 'Failed' | 'Neutral';
    spf_reason?: string;
    dkim_status?: 'Passed' | 'Failed' | 'Neutral';
    dkim_reason?: string;
    dmarc_status?: 'Passed' | 'Failed' | 'Critical Failure';
    dmarc_reason?: string;
    phishing_risk_pct?: number;
    deepfake_voice_pct?: number;
    spoofed_domain?: string;
    target_role?: string;
    attempted_wire_usd?: number;
    key_indicators?: Array<{
      name: string;
      status: string;
      severity: 'error' | 'secondary' | 'primary' | 'tertiary';
    }>;
    voice_similarity_pct?: number;
    speech_flow?: string;
    speech_flow_detail?: string;
    audio_duration_seconds?: number;
    intent?: string;
    intent_detail?: string;
    attachment_name?: string;
    attachment_size?: string;
    attachment_sha256?: string;
    attachment_verdict?: string;
    phishing_url?: string;
    anonymization?: string;
    score_breakdown?: Record<string, number>;
  };
  created_at: string;
}

export interface IOCRecord {
  id: string;
  case_id: string;
  type: 'ip' | 'domain' | 'hash' | 'email' | 'voice_print' | 'actor' | 'victim';
  value: string;
  severity: 'verified' | 'suspicious' | 'critical' | 'neural';
  label: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface IPGeolocationRecord {
  id: string;
  ip: string;
  lat: number;
  lng: number;
  city: string;
  region: string;
  country: string;
  country_code: string;
  asn: string;
  isp: string;
  org: string;
  timezone?: string;
  is_anomalous: boolean;
  looked_up_at: string;
}

export interface ThreatGraphEdge {
  id: string;
  case_id: string;
  source_ioc_id: string;
  target_ioc_id: string;
  relation: string;
  confidence: number;
  severity: 'verified' | 'suspicious' | 'critical' | 'neural';
  created_at?: string;
}

export interface RouteHop {
  id: string;
  case_id: string;
  ip: string;
  hop_order: number;
  role: 'origin' | 'relay' | 'destination';
  tls_verified: boolean;
  latency_ms: number;
  is_anomalous: boolean;
  relay_label: string;
  geo?: IPGeolocationRecord;
  created_at?: string;
}

export interface AuditLogRecord {
  id: string;
  case_id: string;
  actor: string;
  action: string;
  details?: Record<string, any>;
  created_at: string;
}
