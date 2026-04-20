export interface HourlyRow { time: Date; qty: number }
export interface HourlyBucket { hourLabel: string; hourStart: Date; qty: number }

export function bucketHourly(rows: HourlyRow[], now: Date, hours: number): HourlyBucket[] {
  const floorHour = new Date(now);
  floorHour.setUTCMinutes(0, 0, 0);
  const topMs = floorHour.getTime();
  const buckets: HourlyBucket[] = [];
  for (let k = hours; k >= 1; k--) {
    const start = new Date(topMs - k * 3600_000);
    buckets.push({ hourLabel: `H-${k}`, hourStart: start, qty: 0 });
  }
  const windowStart = topMs - hours * 3600_000;
  for (const r of rows) {
    const t = r.time.getTime();
    if (t < windowStart || t >= topMs) continue;
    const idx = Math.floor((t - windowStart) / 3600_000);
    buckets[idx].qty += r.qty;
  }
  return buckets;
}
