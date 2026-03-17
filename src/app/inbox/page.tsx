'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useOnboardingStore } from '@/store/onboardingStore';
import { questionCatalog } from '@/lib/questionCatalog';

function CollaborationRespondContent() {
  const params = useSearchParams();
  const assignmentId = params.get('assignmentId') || '';
  const token = params.get('token') || '';

  const { assignments, respondAssignment, markAssignmentViewed } = useOnboardingStore();

  const assignment = useMemo(() => assignments.find((a) => a.id === assignmentId), [assignments, assignmentId]);

  const [email, setEmail] = useState(assignment?.assignee.email || '');
  const [value, setValue] = useState('');
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');

  if (!assignment) {
    return <div className="rounded-xl border bg-white p-5 text-sm">Assignment not found.</div>;
  }

  const question = questionCatalog.find((q) => q.policyKey === assignment.policyKey);
  const invalidToken = assignment.token !== token;

  if (!invalidToken && assignment.status === 'sent') {
    markAssignmentViewed(assignment.id);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Respond to assignment</h1>
        <p className="text-sm text-slate-600">{question?.title || 'Question'}</p>
      </div>

      {invalidToken ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">Invalid token. Please use the exact share link.</div>
      ) : (
        <div className="space-y-3 rounded-xl border bg-white p-5">
          <div className="text-sm">Message: {assignment.message}</div>
          <label className="space-y-1 text-xs font-medium text-slate-700">
            Your Email
            <input className="mt-1 w-full rounded border px-3 py-2 text-sm font-normal" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-700">
            Your Answer
            <textarea className="mt-1 h-24 w-full rounded border px-3 py-2 text-sm font-normal" placeholder="Enter response" value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-700">
            Comment (Optional)
            <textarea className="mt-1 h-20 w-full rounded border px-3 py-2 text-sm font-normal" placeholder="Any clarification for controller" value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          <button
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white"
            onClick={() => {
              const res = respondAssignment(assignment.id, token, { value, comment, email });
              setMessage(res.ok ? 'Response submitted. Controller must accept to confirm.' : res.error || 'Submission failed');
            }}
          >
            Submit response
          </button>
          {message ? <div className="text-xs text-slate-600">{message}</div> : null}
        </div>
      )}
    </div>
  );
}

export default function CollaborationRespondPage() {
  return (
    <Suspense fallback={<div className="rounded-xl border bg-white p-5 text-sm">Loading response form...</div>}>
      <CollaborationRespondContent />
    </Suspense>
  );
}
