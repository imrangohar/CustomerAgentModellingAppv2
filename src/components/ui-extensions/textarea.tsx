import * as React from 'react';
import { cn } from '@/lib/utils';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'min-h-24 w-full rounded-md border border-app-border bg-white px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-app-blue',
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';
