'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/ui-extensions/page-header';
import { useOnboardingStore } from '@/store/onboardingStore';
import { questionCatalog } from '@/lib/questionCatalog';

export default function CollaborationPage() {
  const { assignments, acceptAssignment, rejectAssignment } = useOnboardingStore();
  const [filter, setFilter] = useState<'all' | 'sent' | 'responded' | 'accepted'>('all');

  const filtered = useMemo(
    () => assignments.filter((a) => (filter === 'all' ? true : a.status === filter)),
    [assignments, filter]
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Collaboration" subtitle="Track assignments, responder input, and acceptance decisions." />

      <div className="flex gap-2">
        {['all', 'sent', 'responded', 'accepted'].map((f) => (
          <button
            key={f}
            className={`rounded border px-3 py-1 text-sm ${filter === f ? 'bg-slate-900 text-white' : ''}`}
            onClick={() => setFilter(f as typeof filter)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((a) => {
          const question = questionCatalog.find((q) => q.policyKey === a.policyKey);
          const overdue = Boolean(a.dueDate && !['accepted'].includes(a.status));
          return (
            <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{question?.title || 'Question'}</div>
                  <div className="text-xs text-slate-500">To: {a.assignee.name} ({a.assignee.email}) • Status: {a.status}</div>
                </div>
                {overdue ? <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-700">Overdue</span> : null}
              </div>

              <div className="mt-2 text-sm text-slate-700">{a.message}</div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Link href={`/collaboration/respond?assignmentId=${a.id}&token=${a.token}`} className="rounded border px-2 py-1">
                  Open responder link
                </Link>
                {a.status === 'responded' ? (
                  <>
                    <button className="rounded bg-emerald-600 px-2 py-1 text-white" onClick={() => acceptAssignment(a.id, { name: 'Controller', email: 'controller@appzen.example' })}>Accept</button>
                    <button className="rounded border px-2 py-1" onClick={() => rejectAssignment(a.id, { name: 'Controller', email: 'controller@appzen.example' }, 'Need clarification')}>Request clarification</button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 ? <div className="rounded border bg-white p-4 text-sm text-slate-500">No assignments in this filter.</div> : null}
      </div>
    </div>
  );
}
