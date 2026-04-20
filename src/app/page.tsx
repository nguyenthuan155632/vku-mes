'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { useAuth } from '@/hooks/use-auth';
import { HeaderBar } from '@/components/dashboard/header-bar';
import { MachineTable } from '@/components/dashboard/machine-table';
import { T } from '@/lib/strings';

interface DashboardResp {
  totals: { running: number; stopped: number; shiftQty: number };
  workcenters: Array<{ id: number; code: string; name: string; status: 'running' | 'stopped'; shiftQty: number; hourly: Array<{ label: string; qty: number }>; runtimeMinutes: number; performancePct: number }>;
}

export default function DashboardPage() {
  const { role } = useAuth();
  const { data, error } = useSWR<DashboardResp>('/api/dashboard', fetcher, {
    refreshInterval: 10_000,
    revalidateOnFocus: false,
    keepPreviousData: true
  });

  if (error) return <main className="p-8 text-red-400">{T.common.error}</main>;
  if (!data || !role) return <main className="p-8 text-muted-foreground">{T.common.loading}</main>;

  return (
    <div>
      <HeaderBar totals={data.totals} />
      <main className="p-6">
        <MachineTable workcenters={data.workcenters} role={role} />
      </main>
    </div>
  );
}
