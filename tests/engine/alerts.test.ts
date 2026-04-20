import { describe, expect, test } from 'vitest';
import { checkLowOutput } from '@/server/engine/alerts';

describe('checkLowOutput', () => {
  test('qty well below threshold -> alert', () => {
    const r = checkLowOutput({ workcenterId: 1, lastHourQty: 100, targetQtyPerHour: 600, thresholdPct: 60, hasOpenAlert: false });
    expect(r.alert?.type).toBe('low_output');
  });

  test('qty above threshold -> no alert', () => {
    const r = checkLowOutput({ workcenterId: 1, lastHourQty: 500, targetQtyPerHour: 600, thresholdPct: 60, hasOpenAlert: false });
    expect(r.alert).toBeUndefined();
  });

  test('dedupes when alert already open', () => {
    const r = checkLowOutput({ workcenterId: 1, lastHourQty: 100, targetQtyPerHour: 600, thresholdPct: 60, hasOpenAlert: true });
    expect(r.alert).toBeUndefined();
  });

  test('target=0 utility machine -> never alerts', () => {
    const r = checkLowOutput({ workcenterId: 1, lastHourQty: 0, targetQtyPerHour: 0, thresholdPct: 60, hasOpenAlert: false });
    expect(r.alert).toBeUndefined();
  });

  test('exactly at threshold -> no alert', () => {
    const r = checkLowOutput({ workcenterId: 1, lastHourQty: 360, targetQtyPerHour: 600, thresholdPct: 60, hasOpenAlert: false });
    expect(r.alert).toBeUndefined();
  });
});
