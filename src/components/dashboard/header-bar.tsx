'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { T } from '@/lib/strings';
import { fmtNum } from '@/lib/format';
import { useAuth } from '@/hooks/use-auth';
import { LiveClock } from './live-clock';
import { KpiChip } from './kpi-chip';

export function HeaderBar({ totals }: { totals: { running: number; stopped: number; shiftQty: number } }) {
  const { role, logout } = useAuth();
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-background/95 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-base font-semibold">{T.appTitle}</Link>
        <LiveClock />
      </div>
      <div className="flex items-center gap-2">
        <KpiChip label={T.dashboard.running} value={totals.running} tone="green" />
        <KpiChip label={T.dashboard.stopped} value={totals.stopped} tone="red" />
        <KpiChip label={T.dashboard.shiftQty} value={fmtNum(totals.shiftQty)} tone="slate" />
      </div>
      <div className="flex items-center gap-2">
        {role && <span className="rounded bg-secondary px-2 py-1 text-xs uppercase tracking-wide">{role}</span>}
        {(role === 'supervisor' || role === 'viewer') && <Link href="/supervisor" className="text-sm underline">{T.supervisor.title}</Link>}
        {role === 'supervisor' && <Link href="/admin/workcenters" className="text-sm underline">{T.admin.title}</Link>}
        <Button variant="secondary" size="sm" onClick={logout}>{T.common.logout}</Button>
      </div>
    </header>
  );
}
