'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fmtNum, fmtPct } from '@/lib/format';
import { T } from '@/lib/strings';

interface Totals {
  qty: number;
  defectQty: number;
}

function KpiCard({ title, value, accent }: { title: string; value: string; accent?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold tabular-nums ${accent ?? 'text-foreground'}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export function OutputSummaryCards({ totals }: { totals: Totals }) {
  const defectRate = totals.qty > 0 ? totals.defectQty / totals.qty : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <KpiCard
        title={T.output.cards.totalQty}
        value={fmtNum(totals.qty)}
        accent="text-blue-400"
      />
      <KpiCard
        title={T.output.cards.defectQty}
        value={fmtNum(totals.defectQty)}
        accent="text-red-400"
      />
      <KpiCard
        title={T.output.cards.defectRate}
        value={fmtPct(defectRate)}
        accent={defectRate > 0.05 ? 'text-amber-400' : 'text-green-400'}
      />
    </div>
  );
}
