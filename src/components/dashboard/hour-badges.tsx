import { fmtNum } from '@/lib/format';
export function HourBadges({ hourly }: { hourly: Array<{ label: string; qty: number }> }) {
  return (
    <div className="flex gap-1">
      {hourly.map((h) => (
        <span key={h.label} className="inline-flex min-w-12 flex-col items-center rounded bg-slate-800 px-2 py-1 text-xs">
          <span className="text-slate-400">{h.label}</span>
          <span className="font-semibold text-slate-100 tabular-nums">{fmtNum(h.qty)}</span>
        </span>
      ))}
    </div>
  );
}
