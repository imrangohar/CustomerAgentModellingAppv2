import { cn } from '@/lib/utils';

const stepLabels = [
  'Company Details',
  'Email Inboxes',
  'Connection Mode',
  'Agents',
  'Data',
  'Review & Activate',
];

export function Stepper({ currentStep, onStepChange }: { currentStep: number; onStepChange: (step: number) => void }) {
  return (
    <div className="mb-7 rounded-2xl border border-app-border bg-white p-4 shadow-soft">
      <div className="grid gap-2 md:grid-cols-6">
      {stepLabels.map((label, index) => {
        const step = index + 1;
        const active = step === currentStep;
        const complete = step < currentStep;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onStepChange(step)}
            className={cn('relative rounded-xl border px-3 py-3 text-left transition', active && 'border-app-blue bg-blue-50/70', complete && 'border-emerald-200 bg-emerald-50/70', !active && !complete && 'border-app-border bg-white hover:bg-slate-50')}
          >
            {index < stepLabels.length - 1 && (
              <span className="absolute -right-2 top-6 hidden h-px w-4 bg-app-border md:block" />
            )}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold',
                  active && 'border-app-blue bg-app-blue text-white',
                  complete && 'border-emerald-600 bg-emerald-600 text-white',
                  !active && !complete && 'border-app-border bg-white text-app-muted'
                )}
              >
                {step}
              </span>
              <span className={cn('text-[11px] font-semibold uppercase tracking-wide', active && 'text-app-blue', complete && 'text-emerald-700', !active && !complete && 'text-app-muted')}>Step {step}</span>
            </div>
            <div className={cn('mt-2 text-sm font-medium leading-tight', active && 'text-app-blue', complete && 'text-emerald-700', !active && !complete && 'text-app-text')}>{label}</div>
          </button>
        );
      })}
      </div>
    </div>
  );
}
