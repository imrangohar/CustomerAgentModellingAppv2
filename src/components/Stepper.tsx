'use client';

import { cn } from '@/lib/utils';

interface StepperProps {
  steps: { id: number; label: string; description?: string; detail?: string; displayStep: number; chip?: string }[];
  currentStep: number;
  onStepClick: (step: number) => void;
}

export function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
        {steps.map((step) => (
          <button
            key={step.id}
            onClick={() => onStepClick(step.id)}
            className={cn(
              'rounded-lg border px-3 py-2 text-left text-sm transition',
              currentStep === step.id
                ? 'border-blue-300 bg-blue-50 text-blue-900 shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            )}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step {step.displayStep}</div>
            <div className="font-medium leading-5">{step.label}</div>
            {step.description ? <div className="mt-1 text-xs text-slate-500">{step.description}</div> : null}
            <div className="mt-2 flex items-center justify-between gap-2">
              {step.chip ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px]">{step.chip}</span> : <span />}
              {step.detail ? <span className="text-[11px] text-slate-500">{step.detail}</span> : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
