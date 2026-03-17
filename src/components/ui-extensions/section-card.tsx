'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SectionCard({
  title,
  subtitle,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white p-5 shadow-sm', className)}>
      {title ? <h2 className="text-lg font-semibold text-slate-900">{title}</h2> : null}
      {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
      <div className={title || subtitle ? 'mt-4' : ''}>{children}</div>
    </section>
  );
}
