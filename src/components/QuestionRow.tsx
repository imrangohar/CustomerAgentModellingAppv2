'use client';

import { AccountPicker } from '@/components/AccountPicker';
import { AssignmentModal } from '@/components/AssignmentModal';
import { CostCenterPicker } from '@/components/CostCenterPicker';
import { HistoryDrawer } from '@/components/HistoryDrawer';
import { SourcesDrawer } from '@/components/SourcesDrawer';
import { StatusPill } from '@/components/ui-extensions/status-pill';
import { Question } from '@/types/policyOnboarding';

export function QuestionRow({
  question,
  value,
  status,
  confidence,
  onChange,
  onConfirm,
  onAssign,
  sources,
  history,
  accounts,
  costCenters,
}: {
  question: Question;
  value: unknown;
  status: string;
  confidence?: number;
  onChange: (value: unknown) => void;
  onConfirm: () => void;
  onAssign: (payload: { name: string; email: string; persona: string; message: string; dueDate?: number }) => void;
  sources: Parameters<typeof SourcesDrawer>[0]['sources'];
  history: Parameters<typeof HistoryDrawer>[0]['events'];
  accounts: { code: string; name: string; type: string; active: boolean }[];
  costCenters: { id: string; name: string; active: boolean; entity?: string }[];
}) {
  const valueString = typeof value === 'string' ? value : '';
  const optionValue =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as { selection?: string; selections?: string[]; description?: string })
      : undefined;
  const selectedSingle = optionValue?.selection ?? (typeof value === 'string' ? value : '');
  const selectedMulti = optionValue?.selections ?? (Array.isArray(value) ? value : []);
  const selectedDescription = optionValue?.description ?? '';
  const statusTone =
    status === 'confirmed'
      ? 'confirmed'
      : status === 'prefilled_needs_confirmation'
        ? 'prefilled'
        : status === 'assigned'
          ? 'assigned'
          : status === 'responded'
            ? 'responded'
            : 'unanswered';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold leading-5 text-slate-900">{question.title}</div>
          <div className="mt-1 text-xs text-slate-500">Owner: {question.ownerPersona} {question.helpText ? `• ${question.helpText}` : ''}</div>
          {status === 'prefilled_needs_confirmation' ? (
            <div className="mt-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">
              Suggested default {confidence ? `(${Math.round(confidence * 100)}% confidence)` : ''}
            </div>
          ) : null}
        </div>
        <StatusPill status={statusTone} />
      </div>

      <div className="mt-3">
        {question.answerType === 'singleSelect' ? (
          <div className="space-y-2">
            <select
              className="w-full rounded border px-2 py-1 text-sm"
              value={selectedSingle}
              onChange={(e) => onChange({ selection: e.target.value, description: selectedDescription })}
            >
              <option value="">Select</option>
              {(question.options || []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <label className="block text-xs font-medium text-slate-600">
              Use-case / Exception Notes
              <textarea
                className="mt-1 h-16 w-full rounded border px-2 py-1 text-sm font-normal"
                placeholder="Add scenario-specific guidance, exceptions, or control language"
                value={selectedDescription}
                onChange={(e) => onChange({ selection: selectedSingle, description: e.target.value })}
              />
            </label>
          </div>
        ) : question.answerType === 'multiSelect' ? (
          <div className="space-y-2">
            <input
              className="w-full rounded border px-2 py-1 text-sm"
              placeholder="Comma-separated values"
              value={selectedMulti.join(', ')}
              onChange={(e) =>
                onChange({
                  selections: e.target.value.split(',').map((x) => x.trim()).filter(Boolean),
                  description: selectedDescription,
                })
              }
            />
            <label className="block text-xs font-medium text-slate-600">
              Use-case / Exception Notes
              <textarea
                className="mt-1 h-16 w-full rounded border px-2 py-1 text-sm font-normal"
                placeholder="Add scenario-specific guidance, exceptions, or control language"
                value={selectedDescription}
                onChange={(e) => onChange({ selections: selectedMulti, description: e.target.value })}
              />
            </label>
          </div>
        ) : question.answerType === 'number' || question.answerType === 'currency' || question.answerType === 'percent' ? (
          <input
            className="w-full rounded border px-2 py-1 text-sm"
            type="number"
            value={typeof value === 'number' ? value : ''}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        ) : question.answerType === 'date' ? (
          <input className="w-full rounded border px-2 py-1 text-sm" type="date" value={valueString} onChange={(e) => onChange(e.target.value)} />
        ) : question.answerType === 'accountPicker' ? (
          <AccountPicker accounts={accounts} value={valueString} onChange={onChange} />
        ) : question.answerType === 'costCenterPicker' ? (
          <CostCenterPicker costCenters={costCenters} value={valueString} onChange={onChange} />
        ) : question.answerType === 'table' ? (
          <textarea className="h-20 w-full rounded border px-2 py-1 text-sm" value={typeof value === 'string' ? value : JSON.stringify(value || '')} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <textarea className="h-16 w-full rounded border px-2 py-1 text-sm" value={valueString} onChange={(e) => onChange(e.target.value)} />
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {status !== 'confirmed' ? (
          <button onClick={onConfirm} className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs text-white hover:bg-emerald-700">Confirm</button>
        ) : null}
        <AssignmentModal onAssign={onAssign} />
        <SourcesDrawer sources={sources} />
        <HistoryDrawer events={history} />
      </div>
    </div>
  );
}
