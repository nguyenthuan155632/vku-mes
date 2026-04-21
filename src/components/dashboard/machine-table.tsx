'use client';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MachineRow } from './machine-row';
import { T } from '@/lib/strings';
import type { Role } from '@/lib/types';

type WcData = Parameters<typeof MachineRow>[0]['wc'];

export function MachineTable({ workcenters, role }: { workcenters: WcData[]; role: Role }) {
  const canEdit = role === 'operator' || role === 'supervisor';
  return (
    <Card className="p-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{T.dashboard.headers.stt}</TableHead>
            <TableHead>{T.dashboard.headers.name}</TableHead>
            <TableHead>{T.dashboard.headers.status}</TableHead>
            <TableHead>{T.dashboard.headers.shiftQty}</TableHead>
            <TableHead>Sản lượng 4 giờ gần nhất</TableHead>
            <TableHead>{T.dashboard.headers.runtime}</TableHead>
            <TableHead>{T.dashboard.headers.performance}</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {workcenters.map((wc, i) => (
            <MachineRow key={wc.id} index={i} wc={wc} canEdit={canEdit} />
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
