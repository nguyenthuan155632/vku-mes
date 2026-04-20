import { describe, expect, test } from 'vitest';
import { shiftWindowFor } from '@/server/engine/shift';

describe('shiftWindowFor', () => {
  test('morning shift in Vietnam -> shift 1', () => {
    // 2026-04-20 09:00 Asia/Ho_Chi_Minh = 02:00 UTC
    const w = shiftWindowFor(new Date('2026-04-20T02:00:00Z'));
    expect(w.number).toBe(1);
    expect(w.date).toBe('2026-04-20');
    expect(w.startsAt.toISOString()).toBe('2026-04-20T01:00:00.000Z');
    expect(w.endsAt.toISOString()).toBe('2026-04-20T13:00:00.000Z');
  });

  test('afternoon shift 2 boundary at 20:00 Vietnam', () => {
    // 2026-04-20 20:00 Asia/Ho_Chi_Minh = 13:00 UTC
    const w = shiftWindowFor(new Date('2026-04-20T13:00:00Z'));
    expect(w.number).toBe(2);
    expect(w.date).toBe('2026-04-20');
    expect(w.startsAt.toISOString()).toBe('2026-04-20T13:00:00.000Z');
    expect(w.endsAt.toISOString()).toBe('2026-04-21T01:00:00.000Z');
  });

  test('shift 2 just before midnight Vietnam', () => {
    // 2026-04-20 23:30 Asia/Ho_Chi_Minh = 16:30 UTC
    const w = shiftWindowFor(new Date('2026-04-20T16:30:00Z'));
    expect(w.number).toBe(2);
    expect(w.date).toBe('2026-04-20');
  });

  test('shift 2 after midnight belongs to previous calendar date', () => {
    // 2026-04-21 03:00 Asia/Ho_Chi_Minh = 2026-04-20 20:00 UTC
    const w = shiftWindowFor(new Date('2026-04-20T20:00:00Z'));
    expect(w.number).toBe(2);
    expect(w.date).toBe('2026-04-20'); // shift 2 anchored to its start date
  });

  test('early morning before 08:00 Vietnam still shift 2 of prior date', () => {
    // 2026-04-21 07:59 Asia/Ho_Chi_Minh = 2026-04-21 00:59 UTC
    const w = shiftWindowFor(new Date('2026-04-21T00:59:00Z'));
    expect(w.number).toBe(2);
    expect(w.date).toBe('2026-04-20');
  });

  test('exactly 08:00 Vietnam rolls to shift 1', () => {
    // 2026-04-21 08:00 Asia/Ho_Chi_Minh = 2026-04-21 01:00 UTC
    const w = shiftWindowFor(new Date('2026-04-21T01:00:00Z'));
    expect(w.number).toBe(1);
    expect(w.date).toBe('2026-04-21');
  });
});
