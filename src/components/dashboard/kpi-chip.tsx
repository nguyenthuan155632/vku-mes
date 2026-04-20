import { cn } from '@/lib/utils';
export function KpiChip({ label, value, tone }: { label: string; value: string | number; tone: 'green' | 'red' | 'slate' }) {
  const toneCls = tone === 'green' ? 'bg-green-500/15 text-green-400' : tone === 'red' ? 'bg-red-500/15 text-red-400' : 'bg-slate-500/15 text-slate-200';
  return (
    <span className={cn('inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm', toneCls)}>
      <span className="opacity-80">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}
