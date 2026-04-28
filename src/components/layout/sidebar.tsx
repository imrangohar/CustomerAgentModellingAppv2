'use client';

import { type ComponentType } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Inbox,
  Settings,
  WandSparkles,
  Workflow,
  Users,
  FileText,
  X,
  Bot,
  Database,
  UserRoundSearch,
  ChevronDown,
  Grid2x2,
  BookMarked,
} from 'lucide-react';

function AppZenLogo() {
  return (
    <Image src="/appzen-logo.png" alt="AppZen" width={0} height={0} sizes="200px" style={{ height: '28px', width: 'auto' }} />
  );
}
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  panel?: 'admin' | 'customers' | 'blueprint' | 'prospect';
};

const defaultNavItems: NavItem[] = [
  { href: '/onboarding', label: 'Onboarding', icon: WandSparkles },
  { href: '/inbox', label: 'Status', icon: Inbox },
  { href: '/agent-model/admin', label: 'Agent Model', icon: Bot },
  { href: '/collaboration', label: 'Collaboration', icon: Users },
  { href: '/sop', label: 'SOP', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const agentModelNavItems: NavItem[] = [
  { href: '/agent-model/admin', label: 'Admin', icon: Database, panel: 'admin' },
  { href: '/agent-model/customers', label: 'Customers', icon: Users, panel: 'customers' },
  { href: '/agent-model/blueprint', label: 'Customers (Blueprint)', icon: BookMarked, panel: 'blueprint' },
  { href: '/agent-model/prospect', label: 'Prospect', icon: UserRoundSearch, panel: 'prospect' },
];

export function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const isAgentModel = pathname.startsWith('/agent-model');
  const navItems = isAgentModel ? agentModelNavItems : defaultNavItems;

  return (
    <>
      <div className={cn('fixed inset-0 z-30 bg-black/30 md:hidden', open ? 'block' : 'hidden')} onClick={onClose} />
      <aside
        className={cn(
          'fixed left-0 z-40 flex w-[260px] flex-col transition-transform',
          isAgentModel
            ? 'top-16 h-[calc(100vh-4rem)] border-r border-[#d8d7d2] bg-[#f5f5f4] text-app-text md:translate-x-0'
            : 'top-0 h-screen border-r border-white/10 bg-app-sidebar text-white md:static md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {isAgentModel ? (
          <>
            <div className="flex items-center justify-between px-4 pb-1 pt-3">
              <button
                onClick={onClose}
                className="rounded-md p-1 text-app-muted hover:bg-slate-100 md:hidden"
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 px-3">
              <div className="rounded-md px-2 py-2 text-base font-medium text-app-text">Agent Modelling</div>
              <div className="mt-1 rounded-md px-2 py-1 text-sm font-medium text-app-text">
                <div className="mb-1 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Settings
                  </span>
                  <ChevronDown className="h-4 w-4 text-app-muted" />
                </div>
              </div>
              <nav className="space-y-1 pl-6">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2 py-2 text-sm text-app-muted transition hover:bg-slate-100',
                        isActive && 'bg-slate-200 font-medium text-app-text'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-3 border-t border-[#d8d7d2] pt-3">
                <div className="rounded-md px-2 py-2 text-sm text-slate-400">Notifications</div>
                <div className="rounded-md px-2 py-2 text-sm text-slate-400">Permissions</div>
                <div className="rounded-md px-2 py-2 text-sm text-slate-400">Audit log</div>
              </div>
            </div>
            <div className="mt-auto border-t border-[#d8d7d2] px-3 py-3">
              <button className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm text-app-muted hover:bg-slate-100">
                <Grid2x2 className="h-4 w-4" />
                Collapse sidebar
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <AppZenLogo />
              <button
                onClick={onClose}
                className="rounded-md p-1 text-slate-300 hover:bg-white/10 md:hidden"
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="space-y-1.5 p-4">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/10',
                      isActive && 'bg-white/15 text-white shadow-inner ring-1 ring-white/20'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto border-t border-white/10 p-4">
              <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10 focus-visible:ring-offset-slate-900">
                <Workflow className="h-4 w-4" />
                Simulate Celebration
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
