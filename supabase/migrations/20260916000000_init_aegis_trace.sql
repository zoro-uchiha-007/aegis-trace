-- ====================================================================
-- AEGIS-TRACE Cyber Forensics & SOC Console Database Migration
-- Target: Supabase (PostgreSQL + RLS + JSONB + UUIDs + Realtime)
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CASES TABLE
CREATE TABLE IF NOT EXISTS public.cases (
    id TEXT PRIMARY KEY, -- E.g. 'CASE-2026-00124'
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'triage' CHECK (status IN ('triage', 'deep_forensics', 'threat_graph', 'geolocation', 'report_pending', 'closed', 'quarantined')),
    severity TEXT NOT NULL DEFAULT 'HIGH' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    target_entity TEXT,
    attempted_amount NUMERIC(14, 2) DEFAULT 0.00,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_to TEXT DEFAULT 'C. Vance (SOC Tier-III Lead)',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. CASE EVIDENCE TABLE
CREATE TABLE IF NOT EXISTS public.case_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id TEXT NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('email', 'audio', 'attachment', 'domain', 'network', 'telemetry')),
    title TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. CASE FINDINGS TABLE
CREATE TABLE IF NOT EXISTS public.case_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id TEXT NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    stage INTEGER NOT NULL CHECK (stage IN (1, 2, 3, 4, 5, 6)),
    verdict TEXT NOT NULL,
    risk_score INTEGER NOT NULL DEFAULT 0,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. INDICATORS OF COMPROMISE (IOC) TABLE
CREATE TABLE IF NOT EXISTS public.ioc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id TEXT NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('ip', 'domain', 'hash', 'email', 'voice_print', 'actor', 'victim')),
    value TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'suspicious' CHECK (severity IN ('verified', 'suspicious', 'critical', 'neural')),
    label TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. IP GEOLOCATION TABLE (Server-side 30-day cache)
CREATE TABLE IF NOT EXISTS public.ip_geolocation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip TEXT UNIQUE NOT NULL,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    city TEXT,
    region TEXT,
    country TEXT,
    country_code TEXT,
    asn TEXT,
    isp TEXT,
    org TEXT,
    timezone TEXT,
    is_anomalous BOOLEAN DEFAULT FALSE,
    looked_up_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ip_geolocation_ip ON public.ip_geolocation(ip);

-- 6. THREAT GRAPH EDGES TABLE
CREATE TABLE IF NOT EXISTS public.threat_graph_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id TEXT NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    source_ioc_id TEXT NOT NULL,
    target_ioc_id TEXT NOT NULL,
    relation TEXT NOT NULL,
    confidence NUMERIC(4, 3) DEFAULT 0.900,
    severity TEXT NOT NULL DEFAULT 'suspicious' CHECK (severity IN ('verified', 'suspicious', 'critical', 'neural')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. ROUTE HOPS TABLE
CREATE TABLE IF NOT EXISTS public.route_hops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id TEXT NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    ip TEXT NOT NULL,
    hop_order INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('origin', 'relay', 'destination')),
    tls_verified BOOLEAN DEFAULT TRUE,
    latency_ms INTEGER DEFAULT 45,
    is_anomalous BOOLEAN DEFAULT FALSE,
    relay_label TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_route_hops_case_order ON public.route_hops(case_id, hop_order);

-- 8. AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id TEXT REFERENCES public.cases(id) ON DELETE SET NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS)
-- ====================================================================

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ioc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_geolocation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threat_graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_hops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view cases
CREATE POLICY "Allow authenticated read on cases" ON public.cases
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert/update on cases" ON public.cases
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow authenticated on related tables
CREATE POLICY "Allow authenticated all on case_evidence" ON public.case_evidence FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated all on case_findings" ON public.case_findings FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated all on ioc" ON public.ioc FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated all on threat_graph_edges" ON public.threat_graph_edges FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated all on route_hops" ON public.route_hops FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated all on audit_log" ON public.audit_log FOR ALL TO authenticated USING (true);

-- Allow public read/write on ip_geolocation for cached backend operations
CREATE POLICY "Allow service/authenticated all on ip_geolocation" ON public.ip_geolocation FOR ALL USING (true);

-- Also enable anonymous read for demo/public prototype mode
CREATE POLICY "Allow anon read cases" ON public.cases FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read evidence" ON public.case_evidence FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read findings" ON public.case_findings FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read ioc" ON public.ioc FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read graph" ON public.threat_graph_edges FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read hops" ON public.route_hops FOR SELECT TO anon USING (true);

-- Enable Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.cases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.case_findings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log;

-- ====================================================================
-- SEED DATA (CASE-2026-00124)
-- ====================================================================

INSERT INTO public.cases (
    id, title, description, status, severity, risk_score, target_entity, attempted_amount, assigned_to
) VALUES (
    'CASE-2026-00124',
    'Targeted Email & Voice Impersonation Scam',
    'High-priority multi-vector executive impersonation attack targeting Chief Financial Officer for unauthorized wire transfer of $428,500.00 USD with synthetic deepfake audio confirmation.',
    'triage',
    'CRITICAL',
    91,
    'Chief Financial Officer',
    428500.00,
    'C. Vance (SOC Tier-III Lead)'
) ON CONFLICT (id) DO NOTHING;

-- Seed Findings
INSERT INTO public.case_findings (case_id, stage, verdict, risk_score, details) VALUES
(
    'CASE-2026-00124',
    1,
    'High Risk Multi-Vector Phishing Attack',
    91,
    '{
        "spf_status": "Failed",
        "spf_reason": "Sender IP 185.220.101.5 is not authorized in published SPF policy",
        "dkim_status": "Passed",
        "dkim_reason": "Valid digital cryptographic signature",
        "dmarc_status": "Critical Failure",
        "dmarc_reason": "Sender domain header does not align with originating infrastructure envelope",
        "phishing_risk_pct": 98,
        "deepfake_voice_pct": 88,
        "spoofed_domain": "corp-bi11ing-us.com",
        "target_role": "Chief Financial Officer",
        "attempted_wire_usd": 428500.00,
        "key_indicators": [
            {"name": "Email Security", "status": "Mismatch", "severity": "error"},
            {"name": "Email Content", "status": "Scam Wording", "severity": "error"},
            {"name": "Voice Clip", "status": "Cloned Voice", "severity": "secondary"},
            {"name": "Link Inspection", "status": "Fake Link", "severity": "error"}
        ]
    }'::jsonb
),
(
    'CASE-2026-00124',
    2,
    'Synthesized Neural Voice Cloning & Typosquatted Credential Harvester',
    94,
    '{
        "voice_similarity_pct": 94.1,
        "speech_flow": "Abnormal",
        "speech_flow_detail": "Unnatural pitch cadence & HiFi-GAN inference glitch detected at 00:22-00:26",
        "audio_duration_seconds": 32,
        "intent": "Urgent Wire",
        "intent_detail": "Fake executive urgency to transfer funds prior to quarterly closing",
        "attachment_name": "urgent_invoice.pdf",
        "attachment_size": "98 KB",
        "attachment_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "attachment_verdict": "Malicious PDF with embedded weaponized link",
        "phishing_url": "https://corp-bi11ing-us.com/login?auth=cfo_wire",
        "anonymization": "Routed through Tor Exit & bulletproof proxy relay in Frankfurt/Amsterdam"
    }'::jsonb
);

-- Seed IOCs
INSERT INTO public.ioc (case_id, type, value, severity, label, metadata) VALUES
('CASE-2026-00124', 'actor', 'threat-actor-adv9@darkrelay.su', 'critical', 'Attacker Entity', '{"role": "Adversary"}'::jsonb),
('CASE-2026-00124', 'email', 'cfo-urgent-approval@corp-bi11ing-us.com', 'critical', 'Phishing Email Lure', '{"subject": "Urgent: Wire Authorization 428.5k"}'::jsonb),
('CASE-2026-00124', 'voice_print', 'VP-NEURAL-CLONE-CFO-00124', 'neural', 'Fake AI Voice Call', '{"similarity": 94.1, "model": "HiFi-GAN"}'::jsonb),
('CASE-2026-00124', 'domain', 'corp-bi11ing-us.com', 'critical', 'Typosquat Domain', '{"dns": "185.220.101.5"}'::jsonb),
('CASE-2026-00124', 'ip', '185.220.101.5', 'critical', 'Tor Exit Node (Relay)', '{"country": "NL", "city": "Amsterdam"}'::jsonb),
('CASE-2026-00124', 'hash', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'critical', 'urgent_invoice.pdf', '{"type": "Trojan.PDF.Dropper"}'::jsonb),
('CASE-2026-00124', 'victim', 'cfo@aegis-corp.internal', 'verified', 'Target: Chief Financial Officer', '{"department": "Finance"}'::jsonb);

-- Seed Threat Graph Edges
INSERT INTO public.threat_graph_edges (case_id, source_ioc_id, target_ioc_id, relation, confidence, severity) VALUES
('CASE-2026-00124', 'threat-actor-adv9@darkrelay.su', 'cfo-urgent-approval@corp-bi11ing-us.com', 'DISPATCHES_LURE', 0.980, 'critical'),
('CASE-2026-00124', 'threat-actor-adv9@darkrelay.su', 'corp-bi11ing-us.com', 'REGISTERED_DOMAIN', 0.940, 'critical'),
('CASE-2026-00124', 'cfo-urgent-approval@corp-bi11ing-us.com', 'VP-NEURAL-CLONE-CFO-00124', 'MULTI_MODAL_CHAIN', 0.942, 'neural'),
('CASE-2026-00124', 'cfo-urgent-approval@corp-bi11ing-us.com', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'CARRIES_ATTACHMENT', 0.990, 'critical'),
('CASE-2026-00124', 'corp-bi11ing-us.com', '185.220.101.5', 'RESOLVES_TO_IP', 0.960, 'critical'),
('CASE-2026-00124', '185.220.101.5', 'threat-actor-adv9@darkrelay.su', 'PROXY_TUNNEL', 0.890, 'suspicious'),
('CASE-2026-00124', 'VP-NEURAL-CLONE-CFO-00124', 'cfo@aegis-corp.internal', 'IMPERSONATES_TO_VICTIM', 0.965, 'neural'),
('CASE-2026-00124', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'cfo@aegis-corp.internal', 'TARGETS_VICTIM', 0.970, 'critical');

-- Seed Geolocation Cache & Route Hops
INSERT INTO public.ip_geolocation (ip, lat, lng, city, region, country, country_code, asn, isp, org, is_anomalous) VALUES
('103.253.144.18', 1.3521, 103.8198, 'Singapore', 'Singapore', 'Singapore', 'SG', 'AS13335', 'Cloudflare Singapore / Bulletproof VPS', 'AS13335 Cloudflare, Inc.', true),
('185.220.101.5', 52.3676, 4.9041, 'Amsterdam', 'North Holland', 'Netherlands', 'NL', 'AS60729', 'Zwiebelfreunde Tor Exit Node', 'AS60729 Zwiebelfreunde e.V.', false),
('198.51.100.42', 38.9072, -77.0369, 'Washington', 'District of Columbia', 'United States', 'US', 'AS14618', 'Amazon Web Services / Corporate Gateway', 'AS14618 Amazon.com, Inc.', false)
ON CONFLICT (ip) DO NOTHING;

INSERT INTO public.route_hops (case_id, ip, hop_order, role, tls_verified, latency_ms, is_anomalous, relay_label) VALUES
('CASE-2026-00124', '103.253.144.18', 1, 'origin', false, 142, true, 'Singapore [SG-TOR-EXIT-01] (Origin)'),
('CASE-2026-00124', '185.220.101.5', 2, 'relay', true, 68, false, 'Amsterdam [NL-RELAY-NODE] (Tor Relay)'),
('CASE-2026-00124', '198.51.100.42', 3, 'destination', true, 18, false, 'Washington D.C. [US-IAD-TARGET] (Victim)')
ON CONFLICT DO NOTHING;

-- Seed Audit Log
INSERT INTO public.audit_log (case_id, actor, action, details) VALUES
('CASE-2026-00124', 'System (Autonomous Triage)', 'Ingested telemetry packet from Exchange Security Gateway', '{"source": "SIEM-Connector"}'::jsonb),
('CASE-2026-00124', 'C. Vance (SOC Lead)', 'Activated Deep Forensics investigation session', '{"session": "SEC-VM-71"}'::jsonb);
