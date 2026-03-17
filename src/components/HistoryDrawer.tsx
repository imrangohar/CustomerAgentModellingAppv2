'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { ChangeEvent } from '@/types/policyOnboarding';

export function HistoryDrawer({ events }: { events: ChangeEvent[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
        View History ({events.length})
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="h-full w-full max-w-xl overflow-auto border-l border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Change History</h3>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-slate-100" aria-label="Close history">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {events.map((ev, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                  <div className="font-semibold text-slate-900">{new Date(ev.timestamp).toLocaleString()}</div>
                  <div className="mt-1 text-slate-600">
                    {ev.changedBy.name} ({ev.changedBy.email})
                  </div>
                  <div className="mt-1 text-slate-700">Reason: {ev.reason || 'n/a'}</div>
                </div>
              ))}
              {events.length === 0 ? <div className="rounded border border-dashed p-4 text-xs text-slate-500">No history recorded yet.</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
