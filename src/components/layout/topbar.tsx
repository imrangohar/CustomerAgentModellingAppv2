'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, ChevronDown, Menu, Sparkles } from 'lucide-react';

function AppZenLogo() {
  return (
    <Image src="/appzen-logo.png" alt="AppZen" width={0} height={0} sizes="200px" style={{ height: '28px', width: 'auto' }} />
  );
}
import { signOut } from 'next-auth/react';

const titles: Record<string, { title: string; subtitle: string }> = {
  '/onboarding': { title: 'Onboarding', subtitle: 'Configure policies and controls for autonomous AP' },
  '/collaboration': { title: 'Collaboration', subtitle: 'Assignments, responses, and acceptance workflow' },
  '/sop': { title: 'SOP', subtitle: 'Generated policy and controls document' },
  '/inbox': { title: 'Status', subtitle: 'Activation status and collaboration queue' },
  '/agent-model': { title: 'Agent Modelling', subtitle: 'Shared metadata and customer modelling workspace' },
  '/settings': { title: 'Settings', subtitle: 'Workspace-level preferences' },
};

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const isAgentModel = pathname.startsWith('/agent-model');
  const info =
    titles[pathname] ||
    (pathname.startsWith('/agent-model')
      ? { title: 'Agent Modelling', subtitle: 'Shared metadata and customer modelling workspace' }
      : { title: 'Workspace', subtitle: 'AP onboarding workspace' });

  if (isAgentModel) {
    return (
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-app-border bg-app-sidebar px-4 text-white md:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="rounded-md p-2 text-slate-200 hover:bg-white/10 md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <AppZenLogo />
        </div>
        <div className="flex items-center gap-4">
          <Bell className="h-4 w-4 text-slate-100" />
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="rounded-md border border-white/25 px-2.5 py-1 text-xs text-white hover:bg-white/10"
          >
            Logout
          </button>
          <div className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-900">SC</div>
            <div className="hidden leading-tight md:block">
              <div className="text-sm">Sarah Chen</div>
              <div className="text-xs text-slate-200">Acme Corporation</div>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-200" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-app-border bg-[#f8f9fb]/95 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden" aria-label="Open menu">
          <Menu className="h-4 w-4" />
        </button>
        <div>
          <div className="text-sm font-semibold text-slate-900">{info.title}</div>
          <div className="text-xs text-slate-500">{info.subtitle}</div>
        </div>
      </div>

        <div className="flex items-center gap-4">
          <Link href="#" className="hidden items-center gap-1.5 text-sm font-medium text-app-blue md:flex">
            <Sparkles className="h-4 w-4" />
            Help & Guidance
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
          >
            Logout
          </button>
          <Bell className="h-4 w-4 text-app-muted" />
          <div className="flex items-center gap-2 text-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">J</div>
          <span className="hidden md:inline">John Smith</span>
          <ChevronDown className="h-4 w-4 text-app-muted" />
        </div>
      </div>
    </header>
  );
}
