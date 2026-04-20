export function RuntimeBar({ minutes }: { minutes: number }) {
  const pct = Math.max(0, Math.min(100, (minutes / 720) * 100));
  const color = pct >= 85 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground tabular-nums">{minutes}/720 phút</span>
      <div className="h-2 w-full overflow-hidden rounded bg-secondary">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
