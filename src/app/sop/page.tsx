'use client';

import { Download, FileJson, Save } from 'lucide-react';
import { SopViewer } from '@/components/SopViewer';
import { PageHeader } from '@/components/ui-extensions/page-header';
import { downloadSopPdf } from '@/lib/pdfExport';
import { generateSopText } from '@/lib/sopGenerator';
import { useOnboardingStore } from '@/store/onboardingStore';

export default function SopPage() {
  const { scopeProfile, answers, sopVersions, saveSopVersion } = useOnboardingStore();
  const content = generateSopText(scopeProfile, answers);

  return (
    <div className="space-y-4">
      <PageHeader
        title="SOP Viewer"
        subtitle="Review policy sections, unresolved items, and download the current SOP snapshot."
        actions={
          <>
            <button
              className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => saveSopVersion(`SOP ${scopeProfile.companyName}`, content)}
            >
              <Save className="h-4 w-4" /> Save Version
            </button>
            <button
              className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
              onClick={() => downloadSopPdf(`sop_${scopeProfile.companyName.replace(/\\s+/g, '_')}.pdf`, 'Policy-Driven AP SOP', content)}
            >
              <Download className="h-4 w-4" /> Download PDF
            </button>
            <button
              className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => {
                const blob = new Blob([JSON.stringify({ scopeProfile, content }, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'sop_export.json';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <FileJson className="h-4 w-4" /> Export JSON
            </button>
          </>
        }
      />

      <SopViewer content={content} />

      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-semibold">Saved versions</div>
        <div className="mt-2 space-y-1 text-xs text-slate-600">
          {sopVersions.map((v) => (
            <div key={v.id}>v{v.version} • {new Date(v.createdAt).toLocaleString()} • {v.title}</div>
          ))}
          {sopVersions.length === 0 ? <div>No versions yet.</div> : null}
        </div>
      </div>
    </div>
  );
}
