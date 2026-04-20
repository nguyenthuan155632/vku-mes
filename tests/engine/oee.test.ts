import { describe, expect, test } from 'vitest';
import { computeOEE } from '@/server/engine/oee';

describe('computeOEE', () => {
  test('all zero inputs returns zero oee with quality=1 default', () => {
    const r = computeOEE({ shiftLengthMin: 480, runtimeMin: 0, totalQty: 0, defectQty: 0, targetQtyPerHour: 600 });
    expect(r.availability).toBe(0);
    expect(r.performance).toBe(0);
    expect(r.quality).toBe(1);
    expect(r.oee).toBe(0);
  });

  test('perfect shift: full runtime, on-target, zero defects', () => {
    const r = computeOEE({ shiftLengthMin: 480, runtimeMin: 480, totalQty: 4800, defectQty: 0, targetQtyPerHour: 600 });
    expect(r.availability).toBe(1);
    expect(r.performance).toBe(1);
    expect(r.quality).toBe(1);
    expect(r.oee).toBe(1);
  });

  test('half runtime, on-target during runtime, zero defects', () => {
    const r = computeOEE({ shiftLengthMin: 480, runtimeMin: 240, totalQty: 2400, defectQty: 0, targetQtyPerHour: 600 });
    expect(r.availability).toBe(0.5);
    expect(r.performance).toBe(1);
    expect(r.quality).toBe(1);
    expect(r.oee).toBe(0.5);
  });

  test('defects reduce quality', () => {
    const r = computeOEE({ shiftLengthMin: 480, runtimeMin: 480, totalQty: 1000, defectQty: 100, targetQtyPerHour: 125 });
    expect(r.quality).toBeCloseTo(0.9);
    expect(r.availability).toBe(1);
    expect(r.performance).toBe(1);
    expect(r.oee).toBeCloseTo(0.9);
  });

  test('target=0 utility machine -> performance=0, oee=0', () => {
    const r = computeOEE({ shiftLengthMin: 480, runtimeMin: 480, totalQty: 0, defectQty: 0, targetQtyPerHour: 0 });
    expect(r.performance).toBe(0);
    expect(r.oee).toBe(0);
  });

  test('values are clamped to [0, 1]', () => {
    const r = computeOEE({ shiftLengthMin: 480, runtimeMin: 600, totalQty: 10000, defectQty: 0, targetQtyPerHour: 600 });
    expect(r.availability).toBe(1);
    expect(r.performance).toBe(1);
  });

  test('defect_qty equal to total_qty -> quality=0', () => {
    const r = computeOEE({ shiftLengthMin: 480, runtimeMin: 480, totalQty: 100, defectQty: 100, targetQtyPerHour: 125 });
    expect(r.quality).toBe(0);
    expect(r.oee).toBe(0);
  });
});
