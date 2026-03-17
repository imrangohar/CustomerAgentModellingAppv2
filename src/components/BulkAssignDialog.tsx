'use client';

import { useMemo, useState } from 'react';

interface StepOption {
  stepId: number;
  label: string;
}

export function BulkAssignDialog({
  open,
  onClose,
  steps,
  defaultSelectedSteps,
  onAssign,
}: {
  open: boolean;
  onClose: () => void;
  steps: StepOption[];
  defaultSelectedSteps: number[];
  onAssign: (payload: {
    selectedSteps: number[];
    assignee: { name: string; email: string; persona: string };
    message: string;
    dueDate?: number;
  }) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [persona, setPersona] = useState('AP Ops');
  const [message, setMessage] = useState('Please provide policy inputs for the assigned questions.');
  const [dueDate, setDueDate] = useState('');

  const effectiveSelected = open && selected.length === 0 ? defaultSelectedSteps : selected;
  const canSubmit = useMemo(
    () => effectiveSelected.length > 0 && name.trim() && email.trim(),
    [effectiveSelected, name, email]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="text-base font-semibold text-slate-900">Assign Questions by Step</div>
        <p className="mt-1 text-sm text-slate-600">Assign all questions in one or more steps to a single assignee.</p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Select Steps</div>
            <div className="mt-2 max-h-56 space-y-2 overflow-auto rounded-lg border border-slate-200 p-2">
              {steps.map((s) => {
                const checked = effectiveSelected.includes(s.stepId);
                return (
                  <label key={s.stepId} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) setSelected((prev) => [...new Set([...effectiveSelected, ...prev, s.stepId])]);
                        else setSelected((prev) => prev.filter((x) => x !== s.stepId));
                      }}
                    />
                    {s.label}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">
              Assignee Name
              <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Assignee Email
              <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Persona
              <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={persona} onChange={(e) => setPersona(e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Due Date
              <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Assignment Message
              <textarea className="mt-1 h-20 w-full rounded border px-2 py-1.5 text-sm" value={message} onChange={(e) => setMessage(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50">
            Cancel
          </button>
          <button
            disabled={!canSubmit}
            onClick={() => {
              onAssign({
                selectedSteps: effectiveSelected,
                assignee: { name: name.trim(), email: email.trim(), persona: persona.trim() || 'AP Ops' },
                message: message.trim(),
                dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
              });
              onClose();
            }}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Assign Selected Steps
          </button>
        </div>
      </div>
    </div>
  );
}
