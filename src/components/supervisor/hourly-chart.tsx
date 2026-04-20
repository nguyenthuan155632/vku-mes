'use client';
import useSWR from 'swr';
import { BarChart, Bar, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetcher } from '@/lib/fetcher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { T } from '@/lib/strings';
import { formatInTimeZone } from 'date-fns-tz';

interface HourlyResp { rows: Array<{ workcenterId: number; hourStart: string; qty: number }> }

export function HourlyChart({ workcenters }: { workcenters: Array<{ id: number; name: string }> }) {
  const { data } = useSWR<HourlyResp>('/api/hourly?hours=8', fetcher, { refreshInterval: 30_000 });
  if (!data) return <Card><CardHeader><CardTitle>{T.supervisor.hourlyChart}</CardTitle></CardHeader><CardContent>{T.common.loading}</CardContent></Card>;

  const byHour = new Map<string, Record<string, number | string>>();
  for (const r of data.rows) {
    const label = formatInTimeZone(new Date(r.hourStart), 'Asia/Ho_Chi_Minh', 'HH:mm');
    if (!byHour.has(label)) byHour.set(label, { hour: label });
    byHour.get(label)![`wc_${r.workcenterId}`] = r.qty;
  }
  const rows = [...byHour.values()];
  const colors = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#f472b6'];

  return (
    <Card>
      <CardHeader><CardTitle>{T.supervisor.hourlyChart}</CardTitle></CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="hour" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1f2937' }} />
            <Legend />
            {workcenters.map((wc, i) => (
              <Bar key={wc.id} dataKey={`wc_${wc.id}`} name={wc.name} fill={colors[i % colors.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
