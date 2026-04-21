'use client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fmtNum, fmtPct } from '@/lib/format';
import { T } from '@/lib/strings';

interface HourlyRow {
  label: string;
  qty: number;
  defectQty: number;
}

export function OutputTable({ hourly }: { hourly: HourlyRow[] }) {
  if (hourly.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground text-sm">
          {T.output.table.noData}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Chi tiết theo giờ</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{T.output.table.hour}</TableHead>
              <TableHead className="text-right tabular-nums">{T.output.table.qty}</TableHead>
              <TableHead className="text-right tabular-nums">{T.output.table.defectQty}</TableHead>
              <TableHead className="text-right tabular-nums">{T.output.table.defectRate}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* hourly is already newest-first from the API */}
            {hourly.map((row, i) => {
              const rate = row.qty > 0 ? row.defectQty / row.qty : 0;
              return (
                <TableRow key={i}>
                  <TableCell className="font-mono text-sm">{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums text-blue-400">{fmtNum(row.qty)}</TableCell>
                  <TableCell className="text-right tabular-nums text-red-400">{fmtNum(row.defectQty)}</TableCell>
                  <TableCell className={`text-right tabular-nums font-semibold ${rate > 0.05 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                    {fmtPct(rate)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
