'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fmtNum, fmtPct } from '@/lib/format';
import { T } from '@/lib/strings';

export function SummaryCards({ data }: {
  data: { shiftQty: number; avgOee: number; running: number; stopped: number; openAlerts: number };
}) {
  const cards = [
    { title: T.supervisor.cards.shiftQty, value: fmtNum(data.shiftQty) },
    { title: T.supervisor.cards.avgOee, value: fmtPct(data.avgOee) },
    { title: T.supervisor.cards.runningStopped, value: `${data.running} / ${data.stopped}` },
    { title: T.supervisor.cards.openAlerts, value: String(data.openAlerts) }
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.title}>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">{c.title}</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold tabular-nums">{c.value}</CardContent>
        </Card>
      ))}
    </div>
  );
}
