import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { shiftTemplatesRepo } from '@/server/repos/shiftTemplates';
import { requireRole } from '@/server/auth/guards';

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function durationMin(start: string, end: string): number {
  const s = timeToMin(start), e = timeToMin(end);
  return e > s ? e - s : 1440 - s + e;
}
function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  const a = timeToMin(s1), b = timeToMin(e1), c = timeToMin(s2), d = timeToMin(e2);
  const inRange = (min: number, start: number, end: number) =>
    end > start ? min >= start && min < end : min >= start || min < end;
  return inRange(c, a, b) || inRange(a, c, d);
}

const CreateBody = z.object({
  name:         z.string().min(1).max(64),
  shift_number: z.number().int().min(1),
  start_time:   z.string().regex(/^\d{2}:\d{2}$/),
  end_time:     z.string().regex(/^\d{2}:\d{2}$/),
});

export async function GET() {
  const role = await requireRole(['operator', 'supervisor', 'viewer']);
  if (role instanceof NextResponse) return role;
  return NextResponse.json(await shiftTemplatesRepo(db).list());
}

export async function POST(req: Request) {
  const role = await requireRole(['supervisor']);
  if (role instanceof NextResponse) return role;

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Dữ liệu không hợp lệ' } }, { status: 400 });
  }

  const { name, shift_number, start_time, end_time } = parsed.data;
  const repo = shiftTemplatesRepo(db);
  const active = await repo.listActive();

  const newDur = durationMin(start_time, end_time);
  const existingTotal = active.reduce((s, t) => s + durationMin(t.startTime, t.endTime), 0);
  if (existingTotal + newDur > 1440) {
    return NextResponse.json(
      { error: { code: 'DURATION_EXCEEDED', message: 'Tổng thời gian ca vượt quá 24 giờ', currentMin: existingTotal, limitMin: 1440 } },
      { status: 422 }
    );
  }

  for (const t of active) {
    if (timesOverlap(start_time, end_time, t.startTime, t.endTime)) {
      return NextResponse.json(
        { error: { code: 'OVERLAP', message: `Khung giờ trùng với ca "${t.name}"` } },
        { status: 422 }
      );
    }
  }

  const row = await repo.create({ name, shiftNumber: shift_number, startTime: start_time, endTime: end_time });
  return NextResponse.json(row, { status: 201 });
}
