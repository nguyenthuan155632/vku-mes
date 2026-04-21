'use client';
import { BarChart, Bar, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { T } from '@/lib/strings';

interface HourlyRow {
  label: string;
  qty: number;
  defectQty: number;
}

export function OutputChart({ hourly }: { hourly: HourlyRow[] }) {
  // Chart wants oldest → newest (left → right)
  const chartData = [...hourly].reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{T.output.chart}</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1f2937', borderRadius: 8 }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Legend />
            <Bar dataKey="qty" name={T.output.legend.qty} fill="#60a5fa" radius={[3, 3, 0, 0]} />
            <Bar dataKey="defectQty" name={T.output.legend.defect} fill="#f87171" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
