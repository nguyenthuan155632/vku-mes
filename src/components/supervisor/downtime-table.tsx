'use client';
import useSWR, { useSWRConfig } from 'swr';
import { useState } from 'react';
import { fetcher } from '@/lib/fetcher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fmtShort, fmtDuration } from '@/lib/format';
import { T } from '@/lib/strings';
import type { Role } from '@/lib/types';

interface Row { id: number; workcenterId: number; startTime: string; endTime: string | null; durationMinutes: number | null; reason: string | null }

export function DowntimeTable({ role, workcenters }: { role: Role; workcenters: Array<{ id: number; name: string }> }) {
  const { data } = useSWR<Row[]>('/api/downtime', fetcher, { refreshInterval: 30_000 });
  const wcName = (id: number) => workcenters.find((w) => w.id === id)?.name ?? `#${id}`;
  return (
    <Card>
      <CardHeader><CardTitle>{T.supervisor.downtimeLog}</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Máy</TableHead>
              <TableHead>Bắt đầu</TableHead>
              <TableHead>Kết thúc</TableHead>
              <TableHead>Thời lượng</TableHead>
              <TableHead>Lý do</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((d) => (
              <TableRow key={d.id}>
                <TableCell>{wcName(d.workcenterId)}</TableCell>
                <TableCell>{fmtShort(d.startTime)}</TableCell>
                <TableCell>{d.endTime ? fmtShort(d.endTime) : '—'}</TableCell>
                <TableCell>{fmtDuration(d.durationMinutes)}</TableCell>
                <TableCell>
                  {role === 'supervisor' ? <ReasonEditor id={d.id} value={d.reason ?? ''} /> : (d.reason ?? '—')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ReasonEditor({ id, value }: { id: number; value: string }) {
  const [v, setV] = useState(value);
  const { mutate } = useSWRConfig();
  async function save() {
    await fetch(`/api/downtime/${id}/reason`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: v }) });
    await mutate('/api/downtime');
  }
  return (
    <Popover>
      <PopoverTrigger asChild><button className="text-left underline decoration-dotted">{value || 'Nhập lý do'}</button></PopoverTrigger>
      <PopoverContent className="flex gap-2">
        <Input value={v} onChange={(e) => setV(e.target.value)} />
        <Button onClick={save} size="sm">{T.admin.save}</Button>
      </PopoverContent>
    </Popover>
  );
}
