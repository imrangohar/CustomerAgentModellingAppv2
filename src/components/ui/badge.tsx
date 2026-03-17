import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      default: 'border-app-border bg-slate-100 text-app-text',
      success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      warning: 'border-orange-200 bg-orange-50 text-orange-700',
      danger: 'border-rose-200 bg-rose-50 text-rose-700',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
