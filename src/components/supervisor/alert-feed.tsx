'use client';
import useSWR, { useSWRConfig } from 'swr';
import { fetcher } from '@/lib/fetcher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fmtShort } from '@/lib/format';
import { T } from '@/lib/strings';
import type { Role } from '@/lib/types';

interface Alert { id: number; workcenterId: number; type: string; message: string; triggeredAt: string }

export function AlertFeed({ role, workcenters }: { role: Role; workcenters: Array<{ id: number; name: string }> }) {
  const { data } = useSWR<Alert[]>('/api/alerts?status=open', fetcher, { refreshInterval: 15_000 });
  const { mutate } = useSWRConfig();
  const wcName = (id: number) => workcenters.find((w) => w.id === id)?.name ?? `#${id}`;
  async function ack(id: number) {
    await fetch(`/api/alerts/${id}/acknowledge`, { method: 'POST' });
    await mutate('/api/alerts?status=open');
  }
  return (
    <Card>
      <CardHeader><CardTitle>{T.supervisor.alertsFeed}</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-2">
        {(data ?? []).length === 0 && <span className="text-sm text-muted-foreground">Không có cảnh báo</span>}
        {(data ?? []).map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded border border-border p-3">
            <div>
              <div className="font-medium">{wcName(a.workcenterId)} — {a.message}</div>
              <div className="text-xs text-muted-foreground">{fmtShort(a.triggeredAt)}</div>
            </div>
            {role === 'supervisor' && <Button size="sm" onClick={() => ack(a.id)}>{T.supervisor.ack}</Button>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
