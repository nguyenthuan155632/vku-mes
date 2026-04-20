'use client';
import { useEffect, useState } from 'react';
import { fmtClock } from '@/lib/format';
export function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  return <span className="tabular-nums text-sm text-muted-foreground">{fmtClock(now)}</span>;
}
