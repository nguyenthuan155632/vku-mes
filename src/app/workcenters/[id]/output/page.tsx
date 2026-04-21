'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { cn } from '@/lib/utils';
import { fetcher } from '@/lib/fetcher';
import { useAuth } from '@/hooks/use-auth';
import { HeaderBar } from '@/components/dashboard/header-bar';
import { OutputChart } from '@/components/output/output-chart';
import { OutputSummaryCards } from '@/components/output/output-summary-cards';
import { OutputTable } from '@/components/output/output-table';
import { T } from '@/lib/strings';

interface OutputResp {
  workcenter: { id: number; code: string; name: string; targetQtyPerHour: number };
  hours: number;
  from: string;
  to: string;
  hourly: Array<{ hourStart: string; label: string; qty: number; defectQty: number }>;
  totals: { qty: number; defectQty: number };
}

interface DashResp {
  totals: { running: number; stopped: number; shiftQty: number };
}

const TIME_OPTIONS = [4, 8, 24] as const;
type Hours = (typeof TIME_OPTIONS)[number];

export default function OutputPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { role } = useAuth();
  const [hours, setHours] = useState<Hours>(8);

  const { data, error } = useSWR<OutputResp>(
    `/api/workcenters/${id}/output?hours=${hours}`,
    fetcher,
    { refreshInterval: 30_000, keepPreviousData: true }
  );

  // Reuse dashboard totals for the shared HeaderBar
  const { data: dash } = useSWR<DashResp>('/api/dashboard', fetcher, {
    refreshInterval: 15_000,
    keepPreviousData: true,
  });

  const headerTotals = dash?.totals ?? { running: 0, stopped: 0, shiftQty: 0 };

  if (!role) return <main className="p-8 text-muted-foreground">{T.common.loading}</main>;
  if (error) return <main className="p-8 text-red-400">{T.common.error}</main>;

  const wc = data?.workcenter;

  return (
    <div>
      <HeaderBar totals={headerTotals} />

      <main className="flex flex-col gap-6 p-6">
        {/* Back + title row */}
        <div className="flex flex-col gap-1">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            {T.common.backToDashboard}
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">
              {wc ? T.output.title(wc.name) : T.common.loading}
            </h1>
            {wc && (
              <span className="rounded bg-secondary px-2 py-1 text-xs font-mono uppercase tracking-wide text-muted-foreground">
                {wc.code}
              </span>
            )}
            {wc && (
              <span className="text-xs text-muted-foreground">
                Mục tiêu: <span className="font-semibold text-foreground">{wc.targetQtyPerHour}/giờ</span>
              </span>
            )}
          </div>
        </div>

        {/* Time-range selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground mr-1">{T.output.timeRange}:</span>
          {TIME_OPTIONS.map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={cn(
                'rounded px-3 py-1 text-sm font-medium transition-colors',
                hours === h
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              )}
            >
              {T.output.hours(h)}
            </button>
          ))}
        </div>

        {/* KPI cards */}
        {data ? (
          <OutputSummaryCards totals={data.totals} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-secondary/40" />
            ))}
          </div>
        )}

        {/* Bar chart */}
        {data ? (
          <OutputChart hourly={data.hourly} />
        ) : (
          <div className="h-72 animate-pulse rounded-xl bg-secondary/40" />
        )}

        {/* Data table */}
        {data ? (
          <OutputTable hourly={data.hourly} />
        ) : (
          <div className="h-48 animate-pulse rounded-xl bg-secondary/40" />
        )}
      </main>
    </div>
  );
}
