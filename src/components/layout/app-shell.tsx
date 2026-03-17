'use client';

import { ReactNode, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAgentModel = pathname.startsWith('/agent-model');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (pathname === '/' || pathname.startsWith('/auth')) {
    return <>{children}</>;
  }

  if (isAgentModel) {
    return (
      <div className="min-h-screen bg-[#efede8]">
        <Topbar onMenuClick={() => setSidebarOpen((prev) => !prev)} />
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="px-4 py-4 md:ml-[260px] md:px-6 md:py-5">
          <div className="mx-auto w-full max-w-[1180px] space-y-4">{children}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#eef1f6]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar onMenuClick={() => setSidebarOpen((prev) => !prev)} />
        <main className="flex-1 px-4 py-5 md:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1320px] space-y-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
