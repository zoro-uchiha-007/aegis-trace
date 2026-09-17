import { 
  CaseRecord, 
  CaseFindings, 
  IOCRecord, 
  ThreatGraphEdge, 
  RouteHop, 
  IPGeolocationRecord, 
  AuditLogRecord 
} from '../supabase/types';

export const STANDBY_CASE: CaseRecord = {
  id: 'CASE-2026-00124',
  title: 'Awaiting Email (.EML) Telemetry Ingestion',
  description: 'Upload an RFC-822 .eml file or paste raw headers to initiate automated multi-vector SPF/DKIM/DMARC triage, threat graph mapping, and geodesic hop tracking.',
  status: 'standby',
  severity: 'LOW',
  risk_score: 0,
  target_entity: 'Awaiting Ingestion',
  attempted_amount: 0,
  assigned_to: 'C. Vance (SOC Tier-III Lead)',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const INITIAL_CASE: CaseRecord = { ...STANDBY_CASE };

export const INITIAL_FINDINGS: CaseFindings[] = [];

/**
 * DEMO_SCENARIO_GEO_CACHE
 * Pre-seeded geolocation records for the 3 demo scenario IPs only.
 * These are NEVER used for real uploaded EML files — those always go through
 * the live ipinfo.io API in /api/geolocation/[ip].
 */
export const DEMO_SCENARIO_GEO_CACHE: Record<string, IPGeolocationRecord> = {
  '103.253.144.18': {
    id: 'geo-sg',
    ip: '103.253.144.18',
    lat: 1.3521,
    lng: 103.8198,
    city: 'Singapore',
    region: 'Central Singapore',
    country: 'Singapore',
    country_code: 'SG',
    asn: 'AS13335',
    isp: 'Cloudflare Singapore / Bulletproof VPS',
    org: 'AS13335 Cloudflare, Inc.',
    timezone: 'Asia/Singapore',
    is_anomalous: true,
    looked_up_at: new Date().toISOString()
  },
  '185.220.101.5': {
    id: 'geo-nl',
    ip: '185.220.101.5',
    lat: 52.3676,
    lng: 4.9041,
    city: 'Amsterdam',
    region: 'North Holland',
    country: 'Netherlands',
    country_code: 'NL',
    asn: 'AS60729',
    isp: 'Zwiebelfreunde Tor Exit Node',
    org: 'AS60729 Zwiebelfreunde e.V.',
    timezone: 'Europe/Amsterdam',
    is_anomalous: false,
    looked_up_at: new Date().toISOString()
  },
  '198.51.100.42': {
    id: 'geo-us',
    ip: '198.51.100.42',
    lat: 38.9072,
    lng: -77.0369,
    city: 'Washington',
    region: 'District of Columbia',
    country: 'United States',
    country_code: 'US',
    asn: 'AS14618',
    isp: 'Amazon Web Services / Corporate Gateway',
    org: 'AS14618 Amazon.com, Inc.',
    timezone: 'America/New_York',
    is_anomalous: false,
    looked_up_at: new Date().toISOString()
  }
};

/** @deprecated Use DEMO_SCENARIO_GEO_CACHE — kept for backward compat during transition */
export const INITIAL_GEO_CACHE = DEMO_SCENARIO_GEO_CACHE;


export const INITIAL_HOPS: RouteHop[] = [];

export const INITIAL_IOCS: IOCRecord[] = [];

export const INITIAL_EDGES: ThreatGraphEdge[] = [];

export const DEMO_HOPS: RouteHop[] = [
  {
    id: 'hop-1',
    case_id: 'CASE-2026-00124',
    ip: '103.253.144.18',
    hop_order: 1,
    role: 'origin',
    tls_verified: false,
    latency_ms: 142,
    is_anomalous: true,
    relay_label: 'Singapore [SG-TOR-EXIT-01] (Origin)',
    geo: DEMO_SCENARIO_GEO_CACHE['103.253.144.18']
  },
  {
    id: 'hop-2',
    case_id: 'CASE-2026-00124',
    ip: '185.220.101.5',
    hop_order: 2,
    role: 'relay',
    tls_verified: true,
    latency_ms: 68,
    is_anomalous: false,
    relay_label: 'Amsterdam [NL-RELAY-NODE] (Tor Relay)',
    geo: DEMO_SCENARIO_GEO_CACHE['185.220.101.5']
  },
  {
    id: 'hop-3',
    case_id: 'CASE-2026-00124',
    ip: '198.51.100.42',
    hop_order: 3,
    role: 'destination',
    tls_verified: true,
    latency_ms: 18,
    is_anomalous: false,
    relay_label: 'Washington D.C. [US-IAD-TARGET] (Victim Gateway)',
    geo: DEMO_SCENARIO_GEO_CACHE['198.51.100.42']
  }
];

export const DEMO_IOCS: IOCRecord[] = [
  {
    id: 'ioc-adversary',
    case_id: 'CASE-2026-00124',
    type: 'actor',
    value: 'threat-actor-adv9@darkrelay.su',
    severity: 'critical',
    label: 'Attacker Entity',
    metadata: { role: 'Adversary Primary Operator', ip: '103.253.144.18' },
    created_at: new Date().toISOString()
  },
  {
    id: 'ioc-email',
    case_id: 'CASE-2026-00124',
    type: 'email',
    value: 'cfo-urgent-approval@corp-bi11ing-us.com',
    severity: 'critical',
    label: 'Phishing Email Lure',
    metadata: { subject: 'Urgent: Wire Authorization $428.5k', headers_spoofed: true },
    created_at: new Date().toISOString()
  },
  {
    id: 'ioc-voice',
    case_id: 'CASE-2026-00124',
    type: 'voice_print',
    value: 'VP-NEURAL-CLONE-CFO-00124',
    severity: 'neural',
    label: 'Fake AI Voice Call',
    metadata: { similarity: '94.1%', synth_type: 'HiFi-GAN Vocoder', confidence: '88%' },
    created_at: new Date().toISOString()
  },
  {
    id: 'ioc-synth',
    case_id: 'CASE-2026-00124',
    type: 'voice_print',
    value: 'HiFi-GAN-V3-Inference-Engine',
    severity: 'neural',
    label: 'Neural Model Clone',
    metadata: { architecture: 'WaveNet / HiFi-GAN', parameters: '14.2M' },
    created_at: new Date().toISOString()
  },
  {
    id: 'ioc-domain',
    case_id: 'CASE-2026-00124',
    type: 'domain',
    value: 'corp-bi11ing-us.com',
    severity: 'critical',
    label: 'Typosquat Domain',
    metadata: { registrar: 'NameCheap Anonymized', nameserver: 'ns1.darkdns.is' },
    created_at: new Date().toISOString()
  },
  {
    id: 'ioc-tor',
    case_id: 'CASE-2026-00124',
    type: 'ip',
    value: '185.220.101.5',
    severity: 'critical',
    label: 'Tor Exit Relay Node',
    metadata: { city: 'Amsterdam', asn: 'AS60729', tls: '1.3' },
    created_at: new Date().toISOString()
  },
  {
    id: 'ioc-attachment',
    case_id: 'CASE-2026-00124',
    type: 'hash',
    value: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    severity: 'critical',
    label: 'urgent_invoice.pdf',
    metadata: { type: 'Trojan.PDF.Dropper', payload_size: '98 KB' },
    created_at: new Date().toISOString()
  },
  {
    id: 'ioc-victim',
    case_id: 'CASE-2026-00124',
    type: 'victim',
    value: 'cfo@aegis-corp.internal',
    severity: 'verified',
    label: 'Target: Chief Financial Officer',
    metadata: { department: 'Corporate Finance', clearance: 'Executive' },
    created_at: new Date().toISOString()
  }
];

export const DEMO_EDGES: ThreatGraphEdge[] = [
  {
    id: 'e-1',
    case_id: 'CASE-2026-00124',
    source_ioc_id: 'ioc-adversary',
    target_ioc_id: 'ioc-email',
    relation: 'DISPATCHES_LURE',
    confidence: 0.980,
    severity: 'critical'
  },
  {
    id: 'e-2',
    case_id: 'CASE-2026-00124',
    source_ioc_id: 'ioc-adversary',
    target_ioc_id: 'ioc-domain',
    relation: 'REGISTERED_DOMAIN',
    confidence: 0.940,
    severity: 'critical'
  },
  {
    id: 'e-3',
    case_id: 'CASE-2026-00124',
    source_ioc_id: 'ioc-email',
    target_ioc_id: 'ioc-voice',
    relation: 'SYNTHETIC_LINK (0.942)',
    confidence: 0.942,
    severity: 'neural'
  },
  {
    id: 'e-4',
    case_id: 'CASE-2026-00124',
    source_ioc_id: 'ioc-voice',
    target_ioc_id: 'ioc-synth',
    relation: 'INFERENCE_CLONE',
    confidence: 0.910,
    severity: 'neural'
  },
  {
    id: 'e-5',
    case_id: 'CASE-2026-00124',
    source_ioc_id: 'ioc-email',
    target_ioc_id: 'ioc-attachment',
    relation: 'INVOICE_DROP',
    confidence: 0.990,
    severity: 'critical'
  },
  {
    id: 'e-6',
    case_id: 'CASE-2026-00124',
    source_ioc_id: 'ioc-domain',
    target_ioc_id: 'ioc-tor',
    relation: 'DNS_RESOLVE',
    confidence: 0.960,
    severity: 'critical'
  },
  {
    id: 'e-7',
    case_id: 'CASE-2026-00124',
    source_ioc_id: 'ioc-tor',
    target_ioc_id: 'ioc-adversary',
    relation: 'PROXY_TUNNEL',
    confidence: 0.890,
    severity: 'suspicious'
  },
  {
    id: 'e-8',
    case_id: 'CASE-2026-00124',
    source_ioc_id: 'ioc-attachment',
    target_ioc_id: 'ioc-victim',
    relation: 'TARGETS_VICTIM',
    confidence: 0.970,
    severity: 'critical'
  },
  {
    id: 'e-9',
    case_id: 'CASE-2026-00124',
    source_ioc_id: 'ioc-voice',
    target_ioc_id: 'ioc-victim',
    relation: 'VOICE_IMPERSONATION',
    confidence: 0.965,
    severity: 'neural'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLogRecord[] = [
  {
    id: 'a-init',
    case_id: 'CASE-2026-00124',
    actor: 'SYSTEM',
    action: 'AEGIS-TRACE engine initialized. Awaiting .EML evidence ingestion to begin forensic analysis.',
    created_at: new Date().toISOString()
  }
];
