import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { caseId, type, title, sender, subject, target, rawHeaders, targetVoiceprint, notes, fileSize } = body;

    const supabase = getSupabaseServerClient();
    const cId = caseId || 'CASE-2026-00124';

    let evidencePayload: any = {};
    let auditAction = '';

    if (type === 'email') {
      evidencePayload = {
        sender: sender || 'cfo-urgent-approval@corp-bi11ing-us.com',
        subject: subject || 'Urgent: Wire Authorization',
        targetRole: target || 'Chief Financial Officer',
        rawHeadersSample: rawHeaders ? rawHeaders.substring(0, 500) : '',
        spfVerdict: 'Failed',
        dkimVerdict: 'Passed',
        dmarcVerdict: 'Critical Failure',
        ingestedAt: new Date().toISOString(),
      };
      auditAction = `Ingested email artifact: "${title || subject}" from ${sender}`;
    } else if (type === 'audio') {
      evidencePayload = {
        title: title || 'executive_wire_voicemail.wav',
        targetVoiceprint: targetVoiceprint || 'VP-CFO-001',
        notes: notes || '',
        fileSize: fileSize || '1.4 MB',
        audioDurationSec: 32,
        voiceSimilarityPct: 94.1,
        deepfakeConfidence: 88,
        glitchWindow: '00:20 - 00:24',
        modelDetected: 'HiFi-GAN Vocoder',
        ingestedAt: new Date().toISOString(),
      };
      auditAction = `Ingested audio sample: "${title}" for neural voiceprint matching`;
    }

    // Persist to Supabase if connected
    if (supabase) {
      try {
        // Insert evidence
        await supabase.from('case_evidence').insert({
          case_id: cId,
          type: type || 'email',
          title: title || (type === 'email' ? 'Email Artifact' : 'Voice Audio Sample'),
          payload: evidencePayload,
        });

        // Insert audit log
        await supabase.from('audit_log').insert({
          case_id: cId,
          actor: 'C. Vance (SOC Lead)',
          action: auditAction,
          details: evidencePayload,
        });
      } catch (dbErr) {
        console.warn('Supabase evidence insertion notice:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      caseId: cId,
      type,
      evidence: evidencePayload,
      message: `${type === 'email' ? 'Email' : 'Audio recording'} evidence successfully ingested and queued for forensic telemetry.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to process evidence upload' },
      { status: 500 }
    );
  }
}
