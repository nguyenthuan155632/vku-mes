'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { HourBadges } from './hour-badges';
import { RuntimeBar } from './runtime-bar';
import { ManualEntryDialog } from './manual-entry-dialog';
import { fmtNum, fmtPct } from '@/lib/format';
import { cn } from '@/lib/utils';
import { T } from '@/lib/strings';

type WcData = { id: number; code: string; name: string; status: 'running' | 'stopped'; shiftQty: number; hourly: Array<{ label: string; qty: number }>; runtimeMinutes: number; performancePct: number };

export function MachineRow({ index, wc, shiftLengthMin, canEdit }: { index: number; wc: WcData; shiftLengthMin: number; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TableRow className="hover:bg-accent/20">
        <TableCell>{index + 1}</TableCell>
        <TableCell className="font-medium">
          <Link
            href={`/workcenters/${wc.id}/output`}
            className="hover:underline hover:text-primary transition-colors"
            title={T.output.title(wc.name)}
          >
            {wc.name}
          </Link>
        </TableCell>
        <TableCell>
          <span className={cn('inline-flex rounded px-2 py-0.5 text-xs', wc.status === 'running' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400')}>
            {wc.status === 'running' ? T.dashboard.running : T.dashboard.stopped}
          </span>
        </TableCell>
        <TableCell className="tabular-nums">{fmtNum(wc.shiftQty)}</TableCell>
        <TableCell><HourBadges hourly={wc.hourly} /></TableCell>
        <TableCell className="w-48"><RuntimeBar minutes={wc.runtimeMinutes} shiftLengthMin={shiftLengthMin} /></TableCell>
        <TableCell className="text-amber-400 tabular-nums font-semibold">{fmtPct(wc.performancePct)}</TableCell>
        <TableCell className="w-10 text-center">
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={T.dashboard.edit}
              onClick={() => setOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </TableCell>
      </TableRow>
      {canEdit && <ManualEntryDialog open={open} onOpenChange={setOpen} workcenter={wc} />}
    </>
  );
}
