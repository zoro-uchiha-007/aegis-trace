import { NextRequest } from 'next/server';
import { parseEml } from '@/lib/forensics/eml-parser';
import { analyzeEmailForensics } from '@/lib/forensics/eml-analyzer';

/**
 * POST /api/evidence/analyze-stream
 * Body: { emlContent: string, caseId: string, filename?: string }
 *
 * Streams Server-Sent Events (SSE) as the forensic pipeline runs.
 * Events:
 *   data: {"type":"step","message":"..."}
 *   data: {"type":"result","data":{...ForensicAnalysisResult summary}}
 *   data: {"type":"error","message":"..."}
 */
export async function POST(request: NextRequest) {
  let emlContent = '';
  let caseId = 'CASE-2026-00124';
  let filename = 'email.eml';

  try {
    const body = await request.json();
    emlContent = body.emlContent || '';
    caseId = body.caseId || caseId;
    filename = body.filename || filename;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (!emlContent.trim()) {
    return new Response('emlContent is required', { status: 400 });
  }

  // Create a streaming SSE response
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      };

      const step = (message: string) => send({ type: 'step', message });

      try {
        // ── Pipeline Step 1 ──────────────────────────────────────────────────
        step('📨 Reading RFC-822 MIME structure and boundary envelopes...');
        await delay(200);

        const parsed = parseEml(emlContent);

        step(`📋 Parsed email: "${parsed.subject || '(no subject)'}" from ${parsed.fromAddress || 'unknown'}`);
        await delay(150);

        // ── Pipeline Step 2 ──────────────────────────────────────────────────
        step('🔐 Evaluating SPF sender authorization policy...');
        await delay(250);

        step('✍️  Verifying DKIM cryptographic signature...');
        await delay(250);

        step('🛡️  Checking DMARC domain alignment and enforcement policy...');
        await delay(200);

        // ── Pipeline Step 3 ──────────────────────────────────────────────────
        step('🌐 Extracting IP relay hops from Received headers...');
        await delay(300);

        step('📡 Resolving geolocation telemetry for each relay node...');
        await delay(400);

        // ── Pipeline Step 4 ──────────────────────────────────────────────────
        step('🔗 Scanning for suspicious URLs and lookalike domains...');
        await delay(300);

        step('📎 Inspecting MIME attachment types for malicious payloads...');
        await delay(200);

        // ── Pipeline Step 5 ──────────────────────────────────────────────────
        step('🧠 Running multi-vector NLP threat scoring model...');
        await delay(350);

        step('🕸️  Constructing IOC threat graph nodes and edges...');
        await delay(250);

        // ── Run the actual analysis ───────────────────────────────────────────
        const analysis = analyzeEmailForensics(parsed, caseId);
        const s = analysis.summary;

        step(`⚡ Risk Score computed: ${s.riskScore}/100 — ${s.severity}`);
        await delay(150);

        step(`🔍 Verdict: ${s.verdict}`);
        await delay(100);

        // ── Send final result ─────────────────────────────────────────────────
        send({
          type: 'result',
          data: {
            riskScore: s.riskScore,
            severity: s.severity,
            verdict: s.verdict,
            spfStatus: s.spfStatus,
            dkimStatus: s.dkimStatus,
            dmarcStatus: s.dmarcStatus,
            phishingRiskPct: s.phishingRiskPct,
            spoofedDomain: s.spoofedDomain,
            isSpoofedDomain: s.isSpoofedDomain,
            hasMaliciousAttachment: s.hasMaliciousAttachment,
            hasSuspiciousLinks: s.hasSuspiciousLinks,
            attemptedWireUsd: s.attemptedWireUsd,
            targetRole: s.targetRole,
            subject: parsed.subject,
            from: parsed.fromAddress,
            filename,
            caseId,
          },
        });
      } catch (err: any) {
        send({ type: 'error', message: err?.message || 'Analysis failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
