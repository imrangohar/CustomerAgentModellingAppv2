'use client';

import { cn } from '@/lib/utils';

export type UiStatus = 'complete' | 'partial' | 'pending' | 'unanswered' | 'prefilled' | 'assigned' | 'responded' | 'confirmed';

const tones: Record<UiStatus, string> = {
  complete: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  partial: 'border-amber-200 bg-amber-50 text-amber-700',
  pending: 'border-slate-200 bg-slate-50 text-slate-700',
  unanswered: 'border-slate-200 bg-slate-50 text-slate-700',
  prefilled: 'border-blue-200 bg-blue-50 text-blue-700',
  assigned: 'border-violet-200 bg-violet-50 text-violet-700',
  responded: 'border-amber-200 bg-amber-50 text-amber-700',
  confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

export function StatusPill({ status, className }: { status: UiStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize tracking-wide',
        tones[status],
        className
      )}
    >
      {status}
    </span>
  );
}
