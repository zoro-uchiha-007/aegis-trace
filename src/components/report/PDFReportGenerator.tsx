'use client';

import React from 'react';
import { CaseRecord, CaseFindings, IOCRecord, RouteHop } from '@/lib/supabase/types';

interface PDFReportGeneratorProps {
  caseData: CaseRecord;
  findings: CaseFindings[];
  iocs: IOCRecord[];
  hops: RouteHop[];
  selectedDisposition: string;
}

export const PDFReportGenerator: React.FC<PDFReportGeneratorProps> = ({
  caseData,
  findings,
  iocs,
  hops,
  selectedDisposition,
}) => {
  const triggerPrint = () => {
    window.print();
  };

  const exportSTIXBundle = () => {
    const stixBundle = {
      type: 'bundle',
      id: `bundle--${crypto.randomUUID ? crypto.randomUUID() : 'fips-00124'}`,
      spec_version: '2.1',
      objects: [
        {
          type: 'incident',
          id: `incident--${caseData.id.toLowerCase()}`,
          name: caseData.title,
          description: caseData.description,
          confidence: caseData.risk_score,
          severity: caseData.severity,
          disposition: selectedDisposition,
          created: caseData.created_at,
        },
        ...iocs.map((ioc) => ({
          type: 'indicator',
          id: `indicator--${ioc.id}`,
          name: ioc.label,
          pattern_type: 'stix',
          pattern: `[${ioc.type}-addr:value = '${ioc.value}']`,
          severity: ioc.severity,
        })),
      ],
    };

    const blob = new Blob([JSON.stringify(stixBundle, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `STIX-2.1-${caseData.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center gap-space-md">
      <button
        onClick={exportSTIXBundle}
        className="px-space-md py-space-sm rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-sm text-body-sm font-semibold transition-all flex items-center justify-center gap-space-xs border border-outline-variant/30"
      >
        <span className="material-symbols-outlined text-base text-secondary">data_object</span>
        <span>STIX 2.1 Bundle</span>
      </button>

      <button
        onClick={triggerPrint}
        className="px-space-md py-space-sm rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-sm text-body-sm font-semibold transition-all flex items-center justify-center gap-space-xs border border-outline-variant/30"
        id="stixBtn"
      >
        <span className="material-symbols-outlined text-base text-primary">picture_as_pdf</span>
        <span>Export Report (PDF)</span>
      </button>
    </div>
  );
};
