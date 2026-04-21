import { describe, expect, test } from 'vitest';
import { shiftWindowFor, type ShiftTemplate } from '@/server/engine/shift';

const TWO_SHIFTS: ShiftTemplate[] = [
  { id: 1, name: 'Ca 1', shiftNumber: 1, startTime: '08:00', endTime: '20:00' },
  { id: 2, name: 'Ca 2', shiftNumber: 2, startTime: '20:00', endTime: '08:00' },
];

const ONE_SHIFT: ShiftTemplate[] = [
  { id: 1, name: 'Ca ngày', shiftNumber: 1, startTime: '08:00', endTime: '16:00' },
];

describe('shiftWindowFor — two 12h shifts (matches previous hardcoded behaviour)', () => {
  test('09:00 VN → shift 1', () => {
    // 2026-04-20 09:00 VN = 02:00 UTC
    const w = shiftWindowFor(new Date('2026-04-20T02:00:00Z'), TWO_SHIFTS);
    expect(w).not.toBeNull();
    expect(w!.number).toBe(1);
    expect(w!.date).toBe('2026-04-20');
    expect(w!.startsAt.toISOString()).toBe('2026-04-20T01:00:00.000Z');
    expect(w!.endsAt.toISOString()).toBe('2026-04-20T13:00:00.000Z');
    expect(w!.shiftLengthMin).toBe(720);
  });

  test('20:00 VN → shift 2', () => {
    // 2026-04-20 20:00 VN = 13:00 UTC
    const w = shiftWindowFor(new Date('2026-04-20T13:00:00Z'), TWO_SHIFTS);
    expect(w!.number).toBe(2);
    expect(w!.date).toBe('2026-04-20');
    expect(w!.startsAt.toISOString()).toBe('2026-04-20T13:00:00.000Z');
    expect(w!.endsAt.toISOString()).toBe('2026-04-21T01:00:00.000Z');
    expect(w!.shiftLengthMin).toBe(720);
  });

  test('23:30 VN → shift 2 before midnight', () => {
    const w = shiftWindowFor(new Date('2026-04-20T16:30:00Z'), TWO_SHIFTS);
    expect(w!.number).toBe(2);
    expect(w!.date).toBe('2026-04-20');
  });

  test('03:00 VN next day → shift 2 anchored to prior date', () => {
    // 2026-04-21 03:00 VN = 2026-04-20 20:00 UTC
    const w = shiftWindowFor(new Date('2026-04-20T20:00:00Z'), TWO_SHIFTS);
    expect(w!.number).toBe(2);
    expect(w!.date).toBe('2026-04-20');
  });

  test('07:59 VN → still shift 2 of prior date', () => {
    const w = shiftWindowFor(new Date('2026-04-21T00:59:00Z'), TWO_SHIFTS);
    expect(w!.number).toBe(2);
    expect(w!.date).toBe('2026-04-20');
  });

  test('08:00 VN exactly → shift 1 of new date', () => {
    const w = shiftWindowFor(new Date('2026-04-21T01:00:00Z'), TWO_SHIFTS);
    expect(w!.number).toBe(1);
    expect(w!.date).toBe('2026-04-21');
  });
});

describe('shiftWindowFor — single 8h shift with gaps', () => {
  test('10:00 VN (inside) → returns window', () => {
    // 10:00 VN = 03:00 UTC
    const w = shiftWindowFor(new Date('2026-04-20T03:00:00Z'), ONE_SHIFT);
    expect(w).not.toBeNull();
    expect(w!.number).toBe(1);
    expect(w!.shiftLengthMin).toBe(480);
  });

  test('07:00 VN (before shift) → null', () => {
    const w = shiftWindowFor(new Date('2026-04-20T00:00:00Z'), ONE_SHIFT);
    expect(w).toBeNull();
  });

  test('17:00 VN (after shift) → null', () => {
    const w = shiftWindowFor(new Date('2026-04-20T10:00:00Z'), ONE_SHIFT);
    expect(w).toBeNull();
  });
});

describe('shiftWindowFor — edge cases', () => {
  test('empty templates → always null', () => {
    expect(shiftWindowFor(new Date('2026-04-20T02:00:00Z'), [])).toBeNull();
  });

  test('exactly at shift end → null (exclusive)', () => {
    // 16:00 VN = 09:00 UTC — endsAt of ONE_SHIFT
    expect(shiftWindowFor(new Date('2026-04-20T09:00:00Z'), ONE_SHIFT)).toBeNull();
  });

  test('exactly at shift start → in window (inclusive)', () => {
    // 08:00 VN = 01:00 UTC
    expect(shiftWindowFor(new Date('2026-04-20T01:00:00Z'), ONE_SHIFT)).not.toBeNull();
  });
});
