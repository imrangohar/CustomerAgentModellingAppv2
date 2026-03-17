'use client';

import { useState } from 'react';

export function AssignmentModal({
  onAssign,
}: {
  onAssign: (payload: { name: string; email: string; persona: string; message: string; dueDate?: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [persona, setPersona] = useState('AP Ops');
  const [message, setMessage] = useState('Please provide your policy input.');
  const [dueDate, setDueDate] = useState('');

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
        Assign
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-white p-4">
            <div className="text-sm font-semibold">Assign question</div>
            <div className="mt-3 grid gap-2">
              <label className="space-y-1 text-xs font-medium text-slate-700">
                Assignee Name
                <input className="mt-1 w-full rounded border px-2 py-1 text-sm font-normal" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-700">
                Assignee Email
                <input className="mt-1 w-full rounded border px-2 py-1 text-sm font-normal" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-700">
                Persona
                <input className="mt-1 w-full rounded border px-2 py-1 text-sm font-normal" placeholder="Persona" value={persona} onChange={(e) => setPersona(e.target.value)} />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-700">
                Message
                <textarea className="mt-1 w-full rounded border px-2 py-1 text-sm font-normal" value={message} onChange={(e) => setMessage(e.target.value)} />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-700">
                Due Date
                <input className="mt-1 w-full rounded border px-2 py-1 text-sm font-normal" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </label>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded border px-3 py-1 text-sm">Cancel</button>
              <button
                onClick={() => {
                  onAssign({ name, email, persona, message, dueDate: dueDate ? new Date(dueDate).getTime() : undefined });
                  setOpen(false);
                }}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
