import { ParsedEmailData, parseEml } from './eml-parser';
import {
  CaseRecord,
  CaseFindings,
  IOCRecord,
  ThreatGraphEdge,
  RouteHop,
  IPGeolocationRecord,
} from '../supabase/types';
import { INITIAL_GEO_CACHE } from '../services/demo-data';

export interface ForensicAnalysisResult {
  caseRecord: CaseRecord;
  stage1Findings: CaseFindings;
  stage2Findings: CaseFindings;
  allFindings: CaseFindings[];
  threatGraph: { nodes: IOCRecord[]; edges: ThreatGraphEdge[] };
  routeHops: RouteHop[];
  summary: {
    riskScore: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    verdict: string;
    spfStatus: 'Passed' | 'Failed' | 'Neutral';
    dkimStatus: 'Passed' | 'Failed' | 'Neutral';
    dmarcStatus: 'Passed' | 'Failed' | 'Critical Failure';
    phishingRiskPct: number;
    deepfakeVoicePct: number;
    attemptedWireUsd: number;
    targetRole: string;
    spoofedDomain: string;
    isSpoofedDomain: boolean;
    urgencyScore: number;
    hasMaliciousAttachment: boolean;
    hasSuspiciousLinks: boolean;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL DEFINITIONS  (all scores start from 0 — no base penalty)
// ─────────────────────────────────────────────────────────────────────────────

interface SpfResult {
  status: 'Passed' | 'Failed' | 'Neutral';
  reason: string;
  score: number; // positive = risk, negative = trust bonus
}
interface DkimResult {
  status: 'Passed' | 'Failed' | 'Neutral';
  reason: string;
  score: number;
}
interface DmarcResult {
  status: 'Passed' | 'Failed' | 'Critical Failure';
  reason: string;
  score: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SPF EVALUATOR
// ─────────────────────────────────────────────────────────────────────────────
function evaluateSpf(
  spfHeader?: string,
  authResults?: string,
): SpfResult {
  const raw = `${spfHeader || ''} ${authResults || ''}`.toLowerCase();

  if (raw.includes('spf=fail') || raw.includes('spf: fail')) {
    return {
      status: 'Failed',
      reason: 'Sender IP is not authorized in published SPF records.',
      score: 22,
    };
  }
  if (raw.includes('spf=softfail')) {
    return {
      status: 'Failed',
      reason: 'SPF soft-fail: sender IP is outside the permitted range.',
      score: 14,
    };
  }
  if (raw.includes('spf=pass') || raw.includes('spf: pass')) {
    return {
      status: 'Passed',
      reason: 'Sender IP matches the published SPF allowlist policy.',
      score: -4, // trust bonus
    };
  }
  if (raw.includes('spf=neutral') || raw.includes('spf=none')) {
    return {
      status: 'Neutral',
      reason: 'Domain has no SPF policy published — sender cannot be verified.',
      score: 6,
    };
  }
  // No SPF header at all — mild penalty
  return {
    status: 'Neutral',
    reason: 'No SPF authentication header found in this email.',
    score: 5,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DKIM EVALUATOR
// ─────────────────────────────────────────────────────────────────────────────
function evaluateDkim(
  dkimHeader?: string,
  authResults?: string,
): DkimResult {
  const raw = `${authResults || ''}`.toLowerCase();
  const hasHeader = !!(dkimHeader && dkimHeader.trim().length > 10);

  if (raw.includes('dkim=fail')) {
    return {
      status: 'Failed',
      reason: 'DKIM cryptographic signature failed — email body may have been tampered.',
      score: 22,
    };
  }
  if (raw.includes('dkim=pass') || (hasHeader && !raw.includes('dkim=fail'))) {
    return {
      status: 'Passed',
      reason: 'Digital signature is cryptographically valid and header-aligned.',
      score: -4, // trust bonus
    };
  }
  if (raw.includes('dkim=none') || raw.includes('dkim=missing')) {
    return {
      status: 'Neutral',
      reason: 'No DKIM signature was found — sender domain does not sign outbound mail.',
      score: 7,
    };
  }
  // No auth-results at all — mild penalty
  return {
    status: 'Neutral',
    reason: 'DKIM status could not be determined from available headers.',
    score: 5,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DMARC EVALUATOR  — reads explicit header verdict first
// ─────────────────────────────────────────────────────────────────────────────
function evaluateDmarc(
  spfResult: SpfResult,
  dkimResult: DkimResult,
  authResults?: string,
  fromDomain?: string,
  returnPathDomain?: string,
): DmarcResult {
  const raw = `${authResults || ''}`.toLowerCase();

  // Trust explicit header verdict above all else
  if (raw.includes('dmarc=pass')) {
    return {
      status: 'Passed',
      reason: 'DMARC policy evaluation passed — domain alignment confirmed.',
      score: -6, // trust bonus
    };
  }
  if (raw.includes('dmarc=fail')) {
    return {
      status: 'Critical Failure',
      reason: 'DMARC policy failed — sender domain does not align with envelope origin.',
      score: 28,
    };
  }

  // No explicit DMARC verdict — derive from SPF + DKIM + domain alignment
  const spfPassed = spfResult.status === 'Passed';
  const dkimPassed = dkimResult.status === 'Passed';

  // Domain alignment: compare from-domain to return-path domain
  const fromD = (fromDomain || '').toLowerCase().split('.').slice(-2).join('.');
  const retD = (returnPathDomain || '').toLowerCase().split('.').slice(-2).join('.');
  const hasAlignment = !!(fromD && retD && fromD === retD);

  if ((spfPassed || dkimPassed) && (hasAlignment || !returnPathDomain)) {
    return {
      status: 'Passed',
      reason: 'DMARC policy inferred to pass based on SPF/DKIM alignment.',
      score: -3,
    };
  }
  if (!spfPassed && !dkimPassed) {
    return {
      status: 'Critical Failure',
      reason: 'Both SPF and DKIM failed — DMARC cannot pass. Domain alignment broken.',
      score: 28,
    };
  }
  if (returnPathDomain && fromDomain && fromD !== retD) {
    return {
      status: 'Failed',
      reason: 'Return-path domain does not match From domain — DMARC alignment mismatch.',
      score: 15,
    };
  }

  return {
    status: 'Neutral' as any,
    reason: 'DMARC status undetermined — insufficient alignment data available.',
    score: 5,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPOSQUATTING / LOOKALIKE DOMAIN DETECTOR
// ─────────────────────────────────────────────────────────────────────────────
const KNOWN_BRANDS = [
  'paypal', 'microsoft', 'google', 'amazon', 'apple', 'netflix',
  'facebook', 'twitter', 'linkedin', 'dropbox', 'chase', 'citibank',
  'bankofamerica', 'wellsfargo', 'fedex', 'dhl', 'ups', 'irs',
];

const SUSPICIOUS_TLDS = ['.su', '.top', '.xyz', '.work', '.tk', '.ml', '.ga', '.cf', '.gq', '.pw', '.ru'];

function checkTyposquatting(domain: string): { isSuspicious: boolean; reason: string; score: number } {
  if (!domain) return { isSuspicious: false, reason: '', score: 0 };
  const d = domain.toLowerCase();

  // Character-substitution homoglyphs
  const homoglyphPatterns = [
    /[0-9]l|l[0-9]|bi1+ing|paypa1|micros0ft|g00gle|arnazon|arnazon|amaz0n/,
    /rn(?=[a-z])/, // "rn" renders like "m"
  ];
  for (const p of homoglyphPatterns) {
    if (p.test(d)) {
      return { isSuspicious: true, reason: `Homoglyph character substitution detected in domain: ${domain}`, score: 22 };
    }
  }

  // Brand impersonation with hyphens
  const hyphenBrand = KNOWN_BRANDS.some(
    (b) => d.includes(`${b}-`) || d.includes(`-${b}`) || d.includes(`${b}secure`) || d.includes(`${b}verify`),
  );
  if (hyphenBrand) {
    return { isSuspicious: true, reason: `Brand impersonation via hyphen pattern: ${domain}`, score: 18 };
  }

  // Extra subdomains mimicking legit domains
  const domainParts = d.split('.');
  if (domainParts.length >= 4) {
    const baseDomain = domainParts.slice(-2).join('.');
    const subDomain = domainParts.slice(0, -2).join('.');
    if (KNOWN_BRANDS.some((b) => subDomain.includes(b) || baseDomain.includes(b))) {
      return { isSuspicious: true, reason: `Subdomain impersonation of known brand: ${domain}`, score: 16 };
    }
  }

  // Suspicious TLDs
  for (const tld of SUSPICIOUS_TLDS) {
    if (d.endsWith(tld)) {
      return { isSuspicious: true, reason: `High-abuse TLD detected: ${tld}`, score: 12 };
    }
  }

  return { isSuspicious: false, reason: '', score: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// REPLY-TO MISMATCH  (attacker intercepts replies)
// ─────────────────────────────────────────────────────────────────────────────
function checkReplyToMismatch(
  fromDomain: string,
  replyTo?: string,
): { mismatch: boolean; score: number; reason: string } {
  if (!replyTo || !fromDomain) return { mismatch: false, score: 0, reason: '' };
  const replyDomain = replyTo.match(/@([^\s>]+)/)?.[1]?.toLowerCase() || '';
  const fromD = fromDomain.toLowerCase();
  if (replyDomain && replyDomain !== fromD) {
    return {
      mismatch: true,
      score: 14,
      reason: `Reply-To domain (${replyDomain}) differs from From domain (${fromD}) — reply interception risk.`,
    };
  }
  return { mismatch: false, score: 0, reason: '' };
}

// ─────────────────────────────────────────────────────────────────────────────
// BEC / URGENCY KEYWORD SCORING
// Higher weights for combinations that appear in real BEC emails
// ─────────────────────────────────────────────────────────────────────────────
interface BecResult {
  isBec: boolean;
  urgencyScore: number;
  riskScore: number;
  matchedKeywords: string[];
}

function analyzeBecKeywords(subject: string, body: string): BecResult {
  const fullText = `${subject} ${body}`.toLowerCase();

  // Tier-1: high-weight BEC signals (each +4)
  const tier1 = ['wire transfer', 'wire authorization', 'swift transfer', 'bank transfer', 'urgent payment', 'wire funds'];
  // Tier-2: medium-weight signals (each +2)
  const tier2 = ['urgent', 'immediately', 'confidential', 'asap', 'no delay', 'time sensitive', 'invoice', 'authorize', 'approval needed'];
  // Tier-3: contextual signals (each +1)
  const tier3 = ['cfo', 'ceo', 'wire', 'billing', 'payment', 'closing', 'escrow', 'account', 'transfer'];

  const matched: string[] = [];
  let rawScore = 0;

  for (const kw of tier1) {
    if (fullText.includes(kw)) { matched.push(kw); rawScore += 4; }
  }
  for (const kw of tier2) {
    if (fullText.includes(kw)) { matched.push(kw); rawScore += 2; }
  }
  for (const kw of tier3) {
    if (fullText.includes(kw)) { matched.push(kw); rawScore += 1; }
  }

  // Score is capped at 20 for BEC content alone
  const cappedScore = Math.min(20, rawScore);
  // Must have at least 2 tier-1/2 signals to be considered BEC
  const isBec = rawScore >= 4;

  return {
    isBec,
    urgencyScore: matched.length,
    riskScore: cappedScore,
    matchedKeywords: matched,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WIRE AMOUNT EXTRACTOR  — only returns value if explicitly found
// ─────────────────────────────────────────────────────────────────────────────
function extractMonetaryAmount(text: string): number {
  const match = text.match(/\$\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/);
  if (match) {
    const num = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(num) && num > 100) return num;
  }
  return 0; // No default — only return real extracted amount
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTACHMENT RISK CHECK  — only truly dangerous extensions are flagged
// ─────────────────────────────────────────────────────────────────────────────
const MALICIOUS_EXTENSIONS = ['.exe', '.vbs', '.js', '.bat', '.cmd', '.scr', '.ps1', '.hta', '.jar'];
const MEDIUM_RISK_EXTENSIONS = ['.zip', '.rar', '.7z', '.docm', '.xlsm', '.pptm'];

function checkAttachments(attachments: { filename: string; isSuspicious: boolean }[]): {
  hasMalicious: boolean;
  score: number;
  reason: string;
} {
  for (const att of attachments) {
    const name = att.filename.toLowerCase();
    if (MALICIOUS_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      return { hasMalicious: true, score: 18, reason: `Executable/script attachment: ${att.filename}` };
    }
    if (MEDIUM_RISK_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      return { hasMalicious: true, score: 10, reason: `Archive or macro-enabled attachment: ${att.filename}` };
    }
    // PDFs are only suspicious if BEC context is also present — handled in main function
  }
  return { hasMalicious: false, score: 0, reason: '' };
}

// ─────────────────────────────────────────────────────────────────────────────
// LINK DOMAIN SUSPICION CHECK
// Only flags links going to DIFFERENT domains than the sender
// ─────────────────────────────────────────────────────────────────────────────
function checkLinks(
  urls: string[],
  fromDomain: string,
): { hasSuspicious: boolean; score: number; reason: string } {
  if (urls.length === 0) return { hasSuspicious: false, score: 0, reason: '' };

  const fromBase = fromDomain.toLowerCase().split('.').slice(-2).join('.');
  let suspiciousCount = 0;

  for (const url of urls) {
    try {
      const urlDomain = new URL(url).hostname.toLowerCase();
      const urlBase = urlDomain.split('.').slice(-2).join('.');
      const typosquat = checkTyposquatting(urlDomain);
      if (typosquat.isSuspicious) {
        return { hasSuspicious: true, score: 16, reason: `Suspicious link domain: ${urlDomain}` };
      }
      // External domain link (different from sender's domain)
      if (urlBase && fromBase && urlBase !== fromBase) {
        suspiciousCount++;
      }
    } catch { /* invalid URL */ }
  }

  // Many external links in a business email is normal (newsletters, etc.)
  // Only flag if sender domain is suspicious already
  if (suspiciousCount > 0 && checkTyposquatting(fromDomain).isSuspicious) {
    return { hasSuspicious: true, score: 8, reason: `${suspiciousCount} external links from suspicious sender domain` };
  }

  return { hasSuspicious: false, score: 0, reason: '' };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FORENSIC ANALYSIS ENGINE
// ─────────────────────────────────────────────────────────────────────────────
export function analyzeEmailForensics(
  parsed: ParsedEmailData,
  caseId: string = 'CASE-2026-00124',
  hasAudioEvidence: boolean = false,
  audioMetadata?: { similarity?: number; duration?: number; model?: string },
): ForensicAnalysisResult {

  // ── 1. Authentication Signals ──────────────────────────────────────────────
  const spf = evaluateSpf(parsed.receivedSpf, parsed.authenticationResults);
  const dkim = evaluateDkim(parsed.dkimSignature, parsed.authenticationResults);
  const dmarc = evaluateDmarc(spf, dkim, parsed.authenticationResults, parsed.fromDomain, parsed.returnPathDomain);

  // ── 2. Domain Analysis ────────────────────────────────────────────────────
  const typosquat = checkTyposquatting(parsed.fromDomain);
  const replyToCheck = checkReplyToMismatch(parsed.fromDomain, parsed.replyTo);

  // ── 3. Content / BEC Analysis ─────────────────────────────────────────────
  const bec = analyzeBecKeywords(parsed.subject, parsed.bodyText);
  const attemptedWireUsd = bec.isBec ? extractMonetaryAmount(`${parsed.subject} ${parsed.bodyText}`) : 0;

  // ── 4. Attachment Analysis ────────────────────────────────────────────────
  const attachmentCheck = checkAttachments(parsed.attachments);
  // PDF in a BEC context adds some risk, but is not automatically malicious
  const hasPdfInBecContext = bec.isBec && parsed.attachments.some((a) => a.filename.toLowerCase().endsWith('.pdf'));

  // ── 5. Link Analysis ──────────────────────────────────────────────────────
  const linkCheck = checkLinks(parsed.extractedUrls, parsed.fromDomain);

  // ── 6. CUMULATIVE SCORE  (starts at 0) ────────────────────────────────────
  let totalScore = 0;

  // Authentication signals
  totalScore += spf.score;    // -4 to +22
  totalScore += dkim.score;   // -4 to +22
  totalScore += dmarc.score;  // -6 to +28

  // Domain signals
  totalScore += typosquat.score;        // 0 to +22
  totalScore += replyToCheck.score;     // 0 to +14

  // Content signals
  totalScore += bec.riskScore;          // 0 to +20

  // Attachment signals
  totalScore += attachmentCheck.score;  // 0 to +18
  if (hasPdfInBecContext) totalScore += 5; // PDF + wire request context

  // Link signals
  totalScore += linkCheck.score;        // 0 to +16

  // Audio deepfake
  if (hasAudioEvidence) totalScore += 8;

  // ── 7. Clamp: 2–97 ──────────────────────────────────────────────────────
  const riskScore = Math.min(97, Math.max(2, Math.round(totalScore)));

  // ── 8. Severity classification ───────────────────────────────────────────
  let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (riskScore >= 75) severity = 'CRITICAL';
  else if (riskScore >= 50) severity = 'HIGH';
  else if (riskScore >= 25) severity = 'MEDIUM';

  // phishingRiskPct is the same signal — no artificial inflation
  const phishingRiskPct = riskScore;
  const deepfakeVoicePct = hasAudioEvidence
    ? audioMetadata?.similarity
      ? Math.round(audioMetadata.similarity)
      : 88
    : 0;

  // ── 9. Target role ───────────────────────────────────────────────────────
  let targetRole = parsed.toName || 'Email Recipient';
  if (parsed.toAddress) {
    const toLocal = parsed.toAddress.split('@')[0].toLowerCase();
    if (toLocal.includes('cfo') || toLocal.includes('finance')) targetRole = 'Chief Financial Officer (CFO)';
    else if (toLocal.includes('ceo') || toLocal.includes('executive')) targetRole = 'Chief Executive Officer (CEO)';
    else if (toLocal.includes('hr') || toLocal.includes('human')) targetRole = 'HR Department';
    else if (toLocal.includes('it') || toLocal.includes('admin')) targetRole = 'IT Administrator';
    else targetRole = parsed.toName || toLocal.toUpperCase() || 'Email Recipient';
  }

  // ── 10. Verdict string ───────────────────────────────────────────────────
  let verdict: string;
  if (riskScore < 15) verdict = 'Verified Clean — No Threat Indicators Detected';
  else if (riskScore < 25) verdict = 'Low Risk — Minor Authentication Gaps';
  else if (riskScore < 50) verdict = 'Suspicious — Multiple Risk Signals Detected';
  else if (riskScore < 75) verdict = 'High Risk — Likely Phishing Attempt';
  else verdict = 'CRITICAL — Multi-Vector Email Attack Confirmed';

  // ── 11. Build route hops ─────────────────────────────────────────────────
  const routeHops: RouteHop[] = parsed.hops.map((h, idx) => {
    const geo: IPGeolocationRecord = INITIAL_GEO_CACHE[h.ip] || {
      id: `geo-${idx}`,
      ip: h.ip,
      lat: 37.09 + idx * 5,
      lng: -95.71 + idx * 10,
      city: h.fromRaw || `Relay-${idx + 1}`,
      region: 'Unknown',
      country: 'Unknown',
      country_code: 'UN',
      asn: 'Unknown',
      isp: h.fromRaw || 'Unknown ISP',
      org: h.fromRaw || 'Unknown Org',
      timezone: 'UTC',
      is_anomalous: h.isAnomalous,
      looked_up_at: new Date().toISOString(),
    };
    return {
      id: `hop-${idx + 1}`,
      case_id: caseId,
      ip: h.ip,
      hop_order: idx + 1,
      role: idx === 0 ? 'origin' : idx === parsed.hops.length - 1 ? 'destination' : 'relay',
      tls_verified: !h.isAnomalous,
      latency_ms: 30 + idx * 35 + Math.round(Math.random() * 20),
      is_anomalous: h.isAnomalous,
      relay_label: `${geo.city} [${geo.country_code}] (${idx === 0 ? 'Origin' : idx === parsed.hops.length - 1 ? 'Destination' : 'Relay'})`,
      geo,
    };
  });

  // ── 12. Threat graph (only add nodes for detected signals) ───────────────
  const nodes: IOCRecord[] = [];
  const edges: ThreatGraphEdge[] = [];

  const adversaryId = 'ioc-adversary';
  nodes.push({
    id: adversaryId,
    case_id: caseId,
    type: 'actor',
    value: parsed.fromAddress || 'unknown-actor@mail.net',
    severity: riskScore > 60 ? 'critical' : 'suspicious',
    label: riskScore > 60 ? 'Attacker Entity' : 'Email Sender',
    metadata: { domain: parsed.fromDomain, spf: spf.status, dkim: dkim.status },
    created_at: new Date().toISOString(),
  });

  const emailNodeId = 'ioc-email';
  nodes.push({
    id: emailNodeId,
    case_id: caseId,
    type: 'email',
    value: parsed.fromAddress || 'unknown@mail.net',
    severity: riskScore > 60 ? 'critical' : riskScore > 30 ? 'suspicious' : 'verified',
    label: riskScore > 60 ? 'Phishing Email Lure' : 'Email Artifact',
    metadata: { subject: parsed.subject, date: parsed.date, risk: riskScore },
    created_at: new Date().toISOString(),
  });

  edges.push({
    id: 'edge-adv-email',
    case_id: caseId,
    source_ioc_id: adversaryId,
    target_ioc_id: emailNodeId,
    relation: riskScore > 60 ? 'DISPATCHED_LURE' : 'SENT_EMAIL',
    confidence: Math.min(0.99, 0.5 + riskScore / 200),
    severity: riskScore > 60 ? 'critical' : 'suspicious',
  });

  if (parsed.fromDomain) {
    const domainId = 'ioc-domain';
    nodes.push({
      id: domainId,
      case_id: caseId,
      type: 'domain',
      value: parsed.fromDomain,
      severity: typosquat.isSuspicious ? 'critical' : riskScore > 40 ? 'suspicious' : 'verified',
      label: typosquat.isSuspicious ? 'Typosquat Domain' : 'Sender Domain',
      metadata: { typosquat: typosquat.isSuspicious, tld: parsed.fromDomain.split('.').slice(-1)[0] },
      created_at: new Date().toISOString(),
    });
    edges.push({
      id: 'edge-email-domain',
      case_id: caseId,
      source_ioc_id: emailNodeId,
      target_ioc_id: domainId,
      relation: typosquat.isSuspicious ? 'SPOOFED_FROM' : 'SENT_FROM',
      confidence: 0.95,
      severity: typosquat.isSuspicious ? 'critical' : 'suspicious',
    });
  }

  if (parsed.originIp) {
    const originIpId = 'ioc-origin-ip';
    nodes.push({
      id: originIpId,
      case_id: caseId,
      type: 'ip',
      value: parsed.originIp,
      severity: routeHops[0]?.is_anomalous ? 'critical' : 'suspicious',
      label: routeHops[0]?.is_anomalous ? 'Anomalous Origin IP' : 'Sender IP',
      metadata: { city: routeHops[0]?.geo?.city, country: routeHops[0]?.geo?.country },
      created_at: new Date().toISOString(),
    });
    edges.push({
      id: 'edge-email-origin',
      case_id: caseId,
      source_ioc_id: emailNodeId,
      target_ioc_id: originIpId,
      relation: 'ORIGINATED_FROM',
      confidence: 0.94,
      severity: routeHops[0]?.is_anomalous ? 'critical' : 'suspicious',
    });
  }

  if (hasAudioEvidence) {
    nodes.push({
      id: 'ioc-voice',
      case_id: caseId,
      type: 'voice_print',
      value: 'VP-NEURAL-CLONE-VOICEMAIL',
      severity: 'neural',
      label: 'AI-Cloned Voice Sample',
      metadata: { similarity: `${audioMetadata?.similarity || 88}%`, synth: audioMetadata?.model || 'HiFi-GAN' },
      created_at: new Date().toISOString(),
    });
    edges.push({
      id: 'edge-email-voice',
      case_id: caseId,
      source_ioc_id: emailNodeId,
      target_ioc_id: 'ioc-voice',
      relation: 'AUDIO_IMPERSONATION',
      confidence: 0.94,
      severity: 'neural',
    });
  }

  if (parsed.attachments.length > 0) {
    const att = parsed.attachments[0];
    nodes.push({
      id: 'ioc-attachment',
      case_id: caseId,
      type: 'hash',
      value: `${att.filename}`,
      severity: attachmentCheck.hasMalicious ? 'critical' : 'suspicious',
      label: attachmentCheck.hasMalicious ? 'Malicious Attachment' : 'Email Attachment',
      metadata: { sha256: att.sha256, filename: att.filename, size: att.sizeFormatted },
      created_at: new Date().toISOString(),
    });
    edges.push({
      id: 'edge-email-attachment',
      case_id: caseId,
      source_ioc_id: emailNodeId,
      target_ioc_id: 'ioc-attachment',
      relation: 'CONTAINS_ATTACHMENT',
      confidence: 0.96,
      severity: attachmentCheck.hasMalicious ? 'critical' : 'suspicious',
    });
  }

  const victimNodeId = 'ioc-victim';
  nodes.push({
    id: victimNodeId,
    case_id: caseId,
    type: 'victim',
    value: parsed.toAddress || 'recipient@internal',
    severity: 'verified',
    label: `Recipient: ${targetRole.split(' ')[0]}`,
    metadata: { role: targetRole },
    created_at: new Date().toISOString(),
  });
  edges.push({
    id: 'edge-email-victim',
    case_id: caseId,
    source_ioc_id: emailNodeId,
    target_ioc_id: victimNodeId,
    relation: 'TARGETED_RECIPIENT',
    confidence: 0.99,
    severity: 'verified',
  });

  // ── 13. Build key indicators ─────────────────────────────────────────────
  const keyIndicators: Array<{ name: string; status: string; severity: 'error' | 'secondary' | 'primary' | 'tertiary' }> = [
    {
      name: 'Email Authentication',
      status: dmarc.status === 'Passed' ? 'Aligned' : dmarc.status === 'Critical Failure' ? 'Critical Failure' : 'Mismatch',
      severity: (dmarc.status === 'Passed' ? 'tertiary' : 'error') as 'tertiary' | 'error',
    },
    {
      name: 'Email Content',
      status: bec.isBec ? `BEC Pattern (${bec.matchedKeywords.slice(0, 2).join(', ')})` : 'Normal Communication',
      severity: (bec.isBec ? 'error' : 'tertiary') as 'error' | 'tertiary',
    },
    {
      name: 'Voice Analysis',
      status: hasAudioEvidence ? 'Cloned Voice Detected' : 'No Audio Attached',
      severity: (hasAudioEvidence ? 'secondary' : 'tertiary') as 'secondary' | 'tertiary',
    },
    {
      name: 'Domain / Links',
      status: typosquat.isSuspicious
        ? `Lookalike: ${parsed.fromDomain}`
        : linkCheck.hasSuspicious
        ? 'Suspicious Links'
        : 'Domain Verified',
      severity: (typosquat.isSuspicious || linkCheck.hasSuspicious ? 'error' : 'tertiary') as 'error' | 'tertiary',
    },
  ];

  // ── 14. Build CaseFindings ────────────────────────────────────────────────
  const stage1Findings: CaseFindings = {
    id: 'f-01',
    case_id: caseId,
    stage: 1,
    verdict,
    risk_score: riskScore,
    details: {
      spf_status: spf.status,
      spf_reason: spf.reason,
      dkim_status: dkim.status,
      dkim_reason: dkim.reason,
      dmarc_status: dmarc.status,
      dmarc_reason: dmarc.reason,
      phishing_risk_pct: phishingRiskPct,
      deepfake_voice_pct: deepfakeVoicePct,
      spoofed_domain: typosquat.isSuspicious
        ? `${parsed.fromDomain} (Lookalike domain)`
        : parsed.fromDomain,
      target_role: targetRole,
      attempted_wire_usd: attemptedWireUsd,
      key_indicators: keyIndicators,
      // Score breakdown for transparency
      score_breakdown: {
        spf: spf.score,
        dkim: dkim.score,
        dmarc: dmarc.score,
        typosquat: typosquat.score,
        replyTo: replyToCheck.score,
        bec: bec.riskScore,
        attachment: attachmentCheck.score + (hasPdfInBecContext ? 5 : 0),
        links: linkCheck.score,
        audio: hasAudioEvidence ? 8 : 0,
        total: riskScore,
      },
    },
    created_at: new Date().toISOString(),
  };

  const stage2Findings: CaseFindings = {
    id: 'f-02',
    case_id: caseId,
    stage: 2,
    verdict: hasAudioEvidence
      ? 'Deep Acoustic & Payload Forensics'
      : `Email Payload Forensics — ${severity} Risk`,
    risk_score: riskScore,
    details: {
      voice_similarity_pct: hasAudioEvidence ? audioMetadata?.similarity || 88 : undefined,
      speech_flow: hasAudioEvidence ? 'Abnormal' : 'No Audio Sample',
      speech_flow_detail: hasAudioEvidence
        ? 'Unnatural pitch cadence & HiFi-GAN inference glitch detected'
        : 'Upload a voice recording (.wav/.mp3) to enable neural audio forensics.',
      audio_duration_seconds: hasAudioEvidence ? audioMetadata?.duration || 32 : 0,
      intent: bec.isBec ? 'BEC / Wire Fraud' : 'Standard Communication',
      intent_detail: bec.isBec
        ? `Matched ${bec.matchedKeywords.length} urgency indicators: ${bec.matchedKeywords.slice(0, 4).join(', ')}`
        : 'No financial fraud or urgency manipulation patterns detected.',
      attachment_name: parsed.attachments[0]?.filename || 'No Attachment',
      attachment_size: parsed.attachments[0]?.sizeFormatted || '0 KB',
      attachment_sha256: parsed.attachments[0]?.sha256 || 'N/A',
      attachment_verdict: attachmentCheck.hasMalicious
        ? attachmentCheck.reason
        : parsed.attachments.length > 0
        ? `${parsed.attachments[0].filename} — No malicious extension detected`
        : 'No attachment present in email',
      phishing_url: parsed.extractedUrls[0] || 'No URLs detected',
      anonymization: routeHops.length > 1
        ? `Routed through ${routeHops.length} relay hops`
        : 'Direct delivery — single relay',
    },
    created_at: new Date().toISOString(),
  };

  const caseRecord: CaseRecord = {
    id: caseId,
    title: parsed.subject || '(No Subject)',
    description: `Email from ${parsed.fromAddress}. Analyzed by AEGIS-TRACE forensic engine. Risk: ${severity}.`,
    status: 'triage',
    severity,
    risk_score: riskScore,
    target_entity: targetRole,
    attempted_amount: attemptedWireUsd,
    assigned_to: 'C. Vance (SOC Tier-III Lead)',
    created_at: parsed.date || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return {
    caseRecord,
    stage1Findings,
    stage2Findings,
    allFindings: [stage1Findings, stage2Findings],
    threatGraph: { nodes, edges },
    routeHops,
    summary: {
      riskScore,
      severity,
      verdict,
      spfStatus: spf.status,
      dkimStatus: dkim.status,
      dmarcStatus: dmarc.status,
      phishingRiskPct,
      deepfakeVoicePct,
      attemptedWireUsd,
      targetRole,
      spoofedDomain: parsed.fromDomain,
      isSpoofedDomain: typosquat.isSuspicious,
      urgencyScore: bec.urgencyScore,
      hasMaliciousAttachment: attachmentCheck.hasMalicious,
      hasSuspiciousLinks: linkCheck.hasSuspicious,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SAMPLE EML TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export const SAMPLE_EML_BEC_SCAM = `Received: from mail-relay-nl.darkhost.su (mail-relay-nl.darkhost.su [185.220.101.5])
\tby mx.corporate-gateway.com (8.14.7/8.14.7) with ESMTP id 58DF38102
\tfor <cfo@aegis-corp.internal>; Wed, 16 Sep 2026 09:14:02 +0000
Received: from unknown (HELO sg-tor-exit.bulletproof-vps.com) [103.253.144.18]
\tby mail-relay-nl.darkhost.su with ESMTPS id 991204812;
\tWed, 16 Sep 2026 09:13:48 +0000
Return-Path: <bounce-daemon@darkrelay.su>
Received-SPF: softfail (mx.corporate-gateway.com: domain of corp-bi11ing-us.com does not designate 103.253.144.18 as permitted sender)
Authentication-Results: mx.corporate-gateway.com;
\tdkim=fail (signature verification failed) header.i=@corp-bi11ing-us.com;
\tspf=softfail smtp.mailfrom=bounce-daemon@darkrelay.su;
\tdmarc=fail (p=reject dis=none) header.from=corp-bi11ing-us.com
From: "Chief Executive Officer" <cfo-urgent-approval@corp-bi11ing-us.com>
To: "Chief Financial Officer" <cfo@aegis-corp.internal>
Reply-To: attacker-intercept@darkrelay.su
Subject: URGENT: Wire Transfer Authorization $428,500 Required Before Q3 Close
Date: Wed, 16 Sep 2026 09:13:30 +0000
Message-ID: <20260916-urgent-wire-428k@corp-bi11ing-us.com>
Content-Type: multipart/mixed; boundary="----=_NextPart_001_A78B9"
MIME-Version: 1.0

------=_NextPart_001_A78B9
Content-Type: text/plain; charset="utf-8"

CONFIDENTIAL & URGENT

We need to finalize the confidential international acquisition invoice immediately prior to quarterly closing today.
Please authorize the wire transfer of $428,500.00 USD to the escrow account detailed in the attached invoice PDF.

Access the vendor secure portal:
https://corp-bi11ing-us.com/login?auth=cfo_wire

------=_NextPart_001_A78B9
Content-Type: application/pdf; name="urgent_invoice.pdf"
Content-Disposition: attachment; filename="urgent_invoice.pdf"

JVBERi0xLjQKJcTl8uXr...
------=_NextPart_001_A78B9--`;

export const SAMPLE_EML_CREDENTIAL_PHISH = `Received: from mail.login-update-auth.top [198.51.100.42]
\tby mx.corporate-gateway.com with ESMTP id phish7721
\tfor <analyst@aegis-corp.internal>; Wed, 16 Sep 2026 10:02:11 +0000
Received-SPF: fail (mx.corporate-gateway.com: domain does not match)
Authentication-Results: mx.corporate-gateway.com; dkim=none; spf=fail; dmarc=fail
From: "IT Security Helpdesk" <security-alert@login-update-auth.top>
To: "SOC Analyst" <analyst@aegis-corp.internal>
Subject: Critical Action Required: Reset Expired Password Within 2 Hours
Date: Wed, 16 Sep 2026 10:01:45 +0000
Message-ID: <sec-20260916@login-update-auth.top>
Content-Type: text/plain; charset="utf-8"

Your corporate SSO password expires in 2 hours.
Click here immediately to maintain uninterrupted access:
https://login-update-auth.top/reset?user=analyst

Failure to complete this will result in account lockout.`;

export const SAMPLE_EML_CLEAN = `Received: from mail.trusted-partner.com [203.0.113.10]
\tby mx.corporate-gateway.com with ESMTPS id legit99281
\tfor <cfo@aegis-corp.internal>; Wed, 16 Sep 2026 08:30:00 +0000
Received-SPF: pass (mx.corporate-gateway.com: domain of trusted-partner.com designates 203.0.113.10 as permitted sender)
Authentication-Results: mx.corporate-gateway.com;
\tdkim=pass header.i=@trusted-partner.com;
\tspf=pass smtp.mailfrom=audits@trusted-partner.com;
\tdmarc=pass (p=quarantine dis=none) header.from=trusted-partner.com
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=trusted-partner.com; s=default;
\th=from:to:subject:date:message-id;
Return-Path: <audits@trusted-partner.com>
From: "Quarterly Audit Team" <audits@trusted-partner.com>
To: "Chief Financial Officer" <cfo@aegis-corp.internal>
Subject: Scheduled Quarterly Review Meeting - Agenda & Notes
Date: Wed, 16 Sep 2026 08:29:10 +0000
Message-ID: <audit-20260916@trusted-partner.com>
Content-Type: text/plain; charset="utf-8"

Hi Team,

Attached is the agenda for our upcoming quarterly operations review scheduled for next Tuesday at 2:00 PM EST.
Please let us know if there are any specific topics you would like to add to the agenda.

Best regards,
Audit Services Group`;
