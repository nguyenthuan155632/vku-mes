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

const UpdateBody = z.object({
  name:         z.string().min(1).max(64).optional(),
  shift_number: z.number().int().min(1).optional(),
  start_time:   z.string().regex(/^\d{2}:\d{2}$/).optional(),
  end_time:     z.string().regex(/^\d{2}:\d{2}$/).optional(),
  is_active:    z.boolean().optional(),
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const role = await requireRole(['supervisor']);
  if (role instanceof NextResponse) return role;

  const id = Number(params.id);
  const repo = shiftTemplatesRepo(db);
  const existing = await repo.getById(id);
  if (!existing) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy ca' } }, { status: 404 });
  }

  const parsed = UpdateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Dữ liệu không hợp lệ' } }, { status: 400 });
  }

  const { name, shift_number, start_time, end_time, is_active } = parsed.data;

  if (is_active !== undefined && is_active !== existing.isActive) {
    if (is_active) {
      const currentTotal = await repo.totalActiveDurationMin();
      if (currentTotal + durationMin(existing.startTime, existing.endTime) > 1440) {
        return NextResponse.json(
          { error: { code: 'DURATION_EXCEEDED', message: 'Tổng thời gian ca vượt quá 24 giờ' } },
          { status: 422 }
        );
      }
    }
    await repo.toggleActive(id, is_active);
  }

  if (start_time !== undefined || end_time !== undefined) {
    const newStart = start_time ?? existing.startTime;
    const newEnd = end_time ?? existing.endTime;
    const newDur = durationMin(newStart, newEnd);
    const otherTotal = await repo.totalActiveDurationMin(id);
    if (existing.isActive && otherTotal + newDur > 1440) {
      return NextResponse.json(
        { error: { code: 'DURATION_EXCEEDED', message: 'Tổng thời gian ca vượt quá 24 giờ', currentMin: otherTotal, limitMin: 1440 } },
        { status: 422 }
      );
    }
    const active = await repo.listActive();
    for (const t of active) {
      if (t.id === id) continue;
      if (timesOverlap(newStart, newEnd, t.startTime, t.endTime)) {
        return NextResponse.json(
          { error: { code: 'OVERLAP', message: `Khung giờ trùng với ca "${t.name}"` } },
          { status: 422 }
        );
      }
    }
  }

  const row = await repo.update(id, {
    ...(name !== undefined && { name }),
    ...(shift_number !== undefined && { shiftNumber: shift_number }),
    ...(start_time !== undefined && { startTime: start_time }),
    ...(end_time !== undefined && { endTime: end_time }),
  });

  return NextResponse.json(row);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const role = await requireRole(['supervisor']);
  if (role instanceof NextResponse) return role;
  const repo = shiftTemplatesRepo(db);
  const existing = await repo.getById(Number(params.id));
  if (!existing) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy ca' } }, { status: 404 });
  }
  await repo.delete(Number(params.id));
  return new NextResponse(null, { status: 204 });
}
