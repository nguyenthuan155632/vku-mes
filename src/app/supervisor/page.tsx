'use client';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { useAuth } from '@/hooks/use-auth';
import { HeaderBar } from '@/components/dashboard/header-bar';
import { SummaryCards } from '@/components/supervisor/summary-cards';
import { HourlyChart } from '@/components/supervisor/hourly-chart';
import { DowntimeTable } from '@/components/supervisor/downtime-table';
import { AlertFeed } from '@/components/supervisor/alert-feed';
import { T } from '@/lib/strings';

interface DashResp { totals: { running: number; stopped: number; shiftQty: number }; workcenters: Array<{ id: number; name: string; runtimeMinutes: number; performancePct: number }> }

export default function SupervisorPage() {
  const { role } = useAuth();
  const { data: dash } = useSWR<DashResp>('/api/dashboard', fetcher, { refreshInterval: 10_000 });
  const { data: alerts } = useSWR<Array<{ id: number }>>('/api/alerts?status=open', fetcher, { refreshInterval: 15_000 });

  if (!role || !dash) return <main className="p-8">{T.common.loading}</main>;

  const totalRuntime = dash.workcenters.reduce((s, w) => s + w.runtimeMinutes, 0);
  const weightedOee = totalRuntime > 0
    ? dash.workcenters.reduce((s, w) => s + w.performancePct * w.runtimeMinutes, 0) / totalRuntime
    : 0;

  return (
    <div>
      <HeaderBar totals={dash.totals} />
      <main className="flex flex-col gap-6 p-6">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          {T.common.backToDashboard}
        </Link>
        <SummaryCards data={{
          shiftQty: dash.totals.shiftQty,
          avgOee: weightedOee,
          running: dash.totals.running,
          stopped: dash.totals.stopped,
          openAlerts: alerts?.length ?? 0
        }} />
        <HourlyChart workcenters={dash.workcenters} />
        <div className="grid gap-6 lg:grid-cols-2">
          <DowntimeTable role={role} workcenters={dash.workcenters} />
          <AlertFeed role={role} workcenters={dash.workcenters} />
        </div>
      </main>
    </div>
  );
}
