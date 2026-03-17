'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { SourceRef } from '@/types/policyOnboarding';

export function SourcesDrawer({ sources }: { sources: SourceRef[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
        View Sources ({sources.length})
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="h-full w-full max-w-xl overflow-auto border-l border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Source Evidence</h3>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-slate-100" aria-label="Close sources">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {sources.map((s, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">{s.type}</div>
                  </div>
                  <pre className="mt-2 whitespace-pre-wrap rounded border border-slate-200 bg-white p-2 text-xs text-slate-700">
                    {JSON.stringify(s, null, 2)}
                  </pre>
                </div>
              ))}
              {sources.length === 0 ? <div className="rounded border border-dashed p-4 text-xs text-slate-500">No sources captured yet.</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
