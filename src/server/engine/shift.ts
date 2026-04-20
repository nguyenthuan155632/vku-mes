const VN_OFFSET_HOURS = 7;
const SHIFT_LEN_MIN = 720; // each shift is 12 h (08:00→20:00 or 20:00→08:00)

export type ShiftNumber = 1 | 2;

export interface ShiftWindow {
  date: string;            // YYYY-MM-DD (Vietnam local)
  number: ShiftNumber;
  startsAt: Date;
  endsAt: Date;
}

function toVnParts(d: Date) {
  const vn = new Date(d.getTime() + VN_OFFSET_HOURS * 3600_000);
  return {
    y: vn.getUTCFullYear(),
    m: vn.getUTCMonth(),     // 0-based
    d: vn.getUTCDate(),
    h: vn.getUTCHours()
  };
}

function vnMidnightUtc(y: number, m: number, d: number): Date {
  // Midnight Vietnam = 17:00 UTC on (previous day)
  return new Date(Date.UTC(y, m, d) - VN_OFFSET_HOURS * 3600_000);
}

function formatDate(y: number, m: number, d: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export function shiftWindowFor(now: Date): ShiftWindow {
  const p = toVnParts(now);
  // Shift 1 covers Vietnam-local 08:00..20:00 on date p.y/p.m/p.d
  if (p.h >= 8 && p.h < 20) {
    const midnight = vnMidnightUtc(p.y, p.m, p.d);
    const startsAt = new Date(midnight.getTime() + 8 * 3600_000);
    const endsAt = new Date(startsAt.getTime() + SHIFT_LEN_MIN * 60_000);
    return { date: formatDate(p.y, p.m, p.d), number: 1, startsAt, endsAt };
  }

  // Shift 2 covers Vietnam-local 20:00..08:00 next day.
  // If current Vietnam hour is 20-23, shift 2 is anchored to today's date.
  // If current Vietnam hour is 0-7, shift 2 is anchored to YESTERDAY's date.
  let anchorY = p.y, anchorM = p.m, anchorD = p.d;
  if (p.h < 8) {
    const prev = new Date(Date.UTC(p.y, p.m, p.d) - 24 * 3600_000);
    anchorY = prev.getUTCFullYear();
    anchorM = prev.getUTCMonth();
    anchorD = prev.getUTCDate();
  }
  const anchorMidnight = vnMidnightUtc(anchorY, anchorM, anchorD);
  const startsAt = new Date(anchorMidnight.getTime() + 20 * 3600_000);
  const endsAt = new Date(startsAt.getTime() + SHIFT_LEN_MIN * 60_000);
  return { date: formatDate(anchorY, anchorM, anchorD), number: 2, startsAt, endsAt };
}

export const SHIFT_LENGTH_MIN = SHIFT_LEN_MIN;
