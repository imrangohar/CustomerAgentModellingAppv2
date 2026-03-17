'use client';

import { LayerStatus } from '@/types/policyOnboarding';
import { layerLabels } from '@/lib/questionCatalog';
import { StatusPill } from '@/components/ui-extensions/status-pill';

export function LayerStatusCards({ statuses }: { statuses: LayerStatus[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {statuses.map((s) => (
        <div key={s.layer} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold">{layerLabels[s.layer]}</div>
          <div className="mt-2">
            <StatusPill status={s.status.toLowerCase() as 'complete' | 'partial' | 'pending'} />
          </div>
          <div className="mt-2 text-xs text-slate-600">
            {s.requiredConfirmed}/{s.requiredTotal} required confirmed
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Needs confirmation: {s.needsConfirmationCount} • Assigned: {s.assignedCount}
          </div>
        </div>
      ))}
    </div>
  );
}
