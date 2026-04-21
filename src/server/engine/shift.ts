const VN_OFFSET_HOURS = 7;

export type ShiftTemplate = {
  id: number;
  name: string;
  shiftNumber: number;
  startTime: string; // "HH:MM" Vietnam local
  endTime: string;   // "HH:MM" Vietnam local
};

export interface ShiftWindow {
  date: string;          // YYYY-MM-DD anchored to shift start date (Vietnam)
  number: number;
  name: string;
  startsAt: Date;
  endsAt: Date;
  shiftLengthMin: number;
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function vnMidnightUtc(y: number, mo: number, d: number): Date {
  return new Date(Date.UTC(y, mo, d) - VN_OFFSET_HOURS * 3600_000);
}

function formatDate(y: number, mo: number, d: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}-${pad(mo + 1)}-${pad(d)}`;
}

/**
 * Returns the ShiftWindow whose window covers `now`, or null if no template covers it.
 * Cross-midnight templates are anchored to the date on which they start.
 */
export function shiftWindowFor(now: Date, templates: ShiftTemplate[]): ShiftWindow | null {
  const vnNow = new Date(now.getTime() + VN_OFFSET_HOURS * 3600_000);
  const y = vnNow.getUTCFullYear();
  const mo = vnNow.getUTCMonth();
  const d = vnNow.getUTCDate();

  for (const tpl of templates) {
    const startMin = timeToMin(tpl.startTime);
    const endMin = timeToMin(tpl.endTime);
    const crossMidnight = endMin <= startMin;
    const durationMin = crossMidnight ? (1440 - startMin + endMin) : (endMin - startMin);

    // Try today's VN-date anchor
    const midnight = vnMidnightUtc(y, mo, d);
    const startsAt = new Date(midnight.getTime() + startMin * 60_000);
    const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
    if (now >= startsAt && now < endsAt) {
      return { date: formatDate(y, mo, d), number: tpl.shiftNumber, name: tpl.name, startsAt, endsAt, shiftLengthMin: durationMin };
    }

    // Cross-midnight: also try yesterday's anchor (e.g. 02:00 VN is inside 20:00→08:00 started yesterday)
    if (crossMidnight) {
      const prev = new Date(Date.UTC(y, mo, d) - 24 * 3600_000);
      const py = prev.getUTCFullYear(), pmo = prev.getUTCMonth(), pd = prev.getUTCDate();
      const prevMidnight = vnMidnightUtc(py, pmo, pd);
      const prevStartsAt = new Date(prevMidnight.getTime() + startMin * 60_000);
      const prevEndsAt = new Date(prevStartsAt.getTime() + durationMin * 60_000);
      if (now >= prevStartsAt && now < prevEndsAt) {
        return { date: formatDate(py, pmo, pd), number: tpl.shiftNumber, name: tpl.name, startsAt: prevStartsAt, endsAt: prevEndsAt, shiftLengthMin: durationMin };
      }
    }
  }

  return null;
}
