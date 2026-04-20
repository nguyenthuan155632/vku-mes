import { describe, expect, test } from 'vitest';
import { bucketHourly } from '@/server/engine/hourly';

describe('bucketHourly', () => {
  test('groups rows into last-N hourly buckets, oldest first', () => {
    const now = new Date('2026-04-20T12:30:00Z');
    const rows = [
      { time: new Date('2026-04-20T11:10:00Z'), qty: 5 },   // H-1
      { time: new Date('2026-04-20T11:45:00Z'), qty: 7 },   // H-1
      { time: new Date('2026-04-20T09:05:00Z'), qty: 3 },   // H-3
      { time: new Date('2026-04-20T08:30:00Z'), qty: 4 }    // H-4
    ];
    const out = bucketHourly(rows, now, 4);
    expect(out).toHaveLength(4);
    expect(out[0].hourLabel).toBe('H-4');
    expect(out[3].hourLabel).toBe('H-1');
    expect(out.find((b) => b.hourLabel === 'H-1')!.qty).toBe(12);
    expect(out.find((b) => b.hourLabel === 'H-2')!.qty).toBe(0);
    expect(out.find((b) => b.hourLabel === 'H-3')!.qty).toBe(3);
    expect(out.find((b) => b.hourLabel === 'H-4')!.qty).toBe(4);
  });

  test('empty rows returns zero-filled buckets', () => {
    const now = new Date('2026-04-20T12:00:00Z');
    const out = bucketHourly([], now, 4);
    expect(out.map((b) => b.qty)).toEqual([0, 0, 0, 0]);
    expect(out.map((b) => b.hourLabel)).toEqual(['H-4', 'H-3', 'H-2', 'H-1']);
  });

  test('rows outside the window are ignored', () => {
    const now = new Date('2026-04-20T12:00:00Z');
    const rows = [
      { time: new Date('2026-04-20T05:00:00Z'), qty: 10 }, // H-7, outside 4h window
      { time: new Date('2026-04-20T11:30:00Z'), qty: 2 }   // H-1
    ];
    const out = bucketHourly(rows, now, 4);
    expect(out.reduce((s, b) => s + b.qty, 0)).toBe(2);
    expect(out.find((b) => b.hourLabel === 'H-1')!.qty).toBe(2);
  });
});
