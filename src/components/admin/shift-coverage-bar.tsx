interface Template { startTime: string; endTime: string; name: string; isActive: boolean }

function timeToMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function durMin(s: string, e: string) { const a = timeToMin(s), b = timeToMin(e); return b > a ? b - a : 1440 - a + b; }

const COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-orange-500'];

// Cross-midnight bars need two segments; returns [{left%, width%}]
function segments(startTime: string, endTime: string) {
  const s = timeToMin(startTime), dur = durMin(startTime, endTime);
  if (s + dur <= 1440) return [{ left: (s / 1440) * 100, width: (dur / 1440) * 100 }];
  return [
    { left: (s / 1440) * 100, width: ((1440 - s) / 1440) * 100 },
    { left: 0, width: ((s + dur - 1440) / 1440) * 100 },
  ];
}

export function ShiftCoverageBar({ templates }: { templates: Template[] }) {
  const active = templates.filter(t => t.isActive);
  const totalMin = active.reduce((s, t) => s + durMin(t.startTime, t.endTime), 0);
  const hasGap = totalMin < 1440;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Phủ sóng theo ngày</span>
        <span className={hasGap ? 'text-amber-500 font-medium' : 'text-green-500 font-medium'}>
          {(totalMin / 60).toFixed(1)}h / 24h {hasGap ? '⚠' : '✓'}
        </span>
      </div>
      <div className="relative h-3 rounded bg-muted overflow-hidden">
        {active.map((t, i) =>
          segments(t.startTime, t.endTime).map((seg, j) => (
            <div
              key={`${t.name}-${j}`}
              className={`absolute h-full ${COLORS[i % COLORS.length]} opacity-80`}
              style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
              title={t.name}
            />
          ))
        )}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        {['00:00', '06:00', '12:00', '18:00', '24:00'].map(l => <span key={l}>{l}</span>)}
      </div>
      {hasGap && (
        <p className="text-xs text-amber-600">
          ⚠ {(1440 - totalMin) / 60}h chưa được lên lịch — sản phẩm ngoài ca sẽ tạo cảnh báo.
        </p>
      )}
    </div>
  );
}
