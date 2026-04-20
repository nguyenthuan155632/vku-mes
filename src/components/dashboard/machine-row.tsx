'use client';
import { useState } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { HourBadges } from './hour-badges';
import { RuntimeBar } from './runtime-bar';
import { ManualEntryDialog } from './manual-entry-dialog';
import { fmtNum, fmtPct } from '@/lib/format';
import { cn } from '@/lib/utils';
import { T } from '@/lib/strings';

type WcData = { id: number; code: string; name: string; status: 'running' | 'stopped'; shiftQty: number; hourly: Array<{ label: string; qty: number }>; runtimeMinutes: number; performancePct: number };

export function MachineRow({ index, wc, canEdit }: { index: number; wc: WcData; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TableRow onClick={() => canEdit && setOpen(true)} className={canEdit ? 'cursor-pointer hover:bg-accent/40' : undefined}>
        <TableCell>{index + 1}</TableCell>
        <TableCell className="font-medium">{wc.name}</TableCell>
        <TableCell>
          <span className={cn('inline-flex rounded px-2 py-0.5 text-xs', wc.status === 'running' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400')}>
            {wc.status === 'running' ? T.dashboard.running : T.dashboard.stopped}
          </span>
        </TableCell>
        <TableCell className="tabular-nums">{fmtNum(wc.shiftQty)}</TableCell>
        <TableCell><HourBadges hourly={wc.hourly} /></TableCell>
        <TableCell className="w-48"><RuntimeBar minutes={wc.runtimeMinutes} /></TableCell>
        <TableCell className="text-amber-400 tabular-nums font-semibold">{fmtPct(wc.performancePct)}</TableCell>
      </TableRow>
      {canEdit && <ManualEntryDialog open={open} onOpenChange={setOpen} workcenter={wc} />}
    </>
  );
}
