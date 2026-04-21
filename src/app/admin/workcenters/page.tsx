'use client';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { HeaderBar } from '@/components/dashboard/header-bar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { WorkcenterForm } from '@/components/admin/workcenter-form';
import { T } from '@/lib/strings';

interface Wc { id: number; code: string; name: string; targetQtyPerHour: number; alertThresholdMinutes: number; lowOutputThresholdPct: number }

export default function AdminWorkcentersPage() {
  const { data } = useSWR<Wc[]>('/api/workcenters', fetcher);
  const { data: dash } = useSWR<{ totals: { running: number; stopped: number; shiftQty: number } }>('/api/dashboard', fetcher, { refreshInterval: 30_000 });
  return (
    <div>
      <HeaderBar totals={dash?.totals ?? { running: 0, stopped: 0, shiftQty: 0 }} />
      <main className="flex flex-col gap-4 p-6">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          {T.common.backToDashboard}
        </Link>
        <Link
          href="/admin/shifts"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          → {T.shifts.title}
        </Link>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{T.admin.title}</CardTitle>
            <WorkcenterForm mode="create" trigger={<Button>{T.admin.create}</Button>} />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{T.admin.columns.code}</TableHead>
                  <TableHead>{T.admin.columns.name}</TableHead>
                  <TableHead>{T.admin.columns.target}</TableHead>
                  <TableHead>{T.admin.columns.alertThreshold}</TableHead>
                  <TableHead>{T.admin.columns.lowOutputPct}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>{w.code}</TableCell>
                    <TableCell>{w.name}</TableCell>
                    <TableCell className="tabular-nums">{w.targetQtyPerHour}</TableCell>
                    <TableCell className="tabular-nums">{w.alertThresholdMinutes}</TableCell>
                    <TableCell className="tabular-nums">{w.lowOutputThresholdPct}</TableCell>
                    <TableCell>
                      <WorkcenterForm mode="edit" wc={w} trigger={<Button variant="secondary" size="sm">{T.admin.edit}</Button>} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
