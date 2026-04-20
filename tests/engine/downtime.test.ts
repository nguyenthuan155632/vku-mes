import { describe, expect, test } from 'vitest';
import { detectDowntime } from '@/server/engine/downtime';

const now = new Date('2026-04-20T12:00:00Z');
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);

describe('detectDowntime', () => {
  test('recent pulse, no open downtime -> no action', () => {
    const r = detectDowntime({ workcenterId: 1, lastPulseAt: minsAgo(3), openDowntime: null, alertThresholdMin: 10, now });
    expect(r.action).toBe('none');
    expect(r.alert).toBeUndefined();
  });

  test('silent past threshold, no open downtime -> open + alert', () => {
    const r = detectDowntime({ workcenterId: 1, lastPulseAt: minsAgo(15), openDowntime: null, alertThresholdMin: 10, now });
    expect(r.action).toMatchObject({ kind: 'open' });
    if (typeof r.action !== 'string') {
      expect((r.action as { startTime: Date }).startTime).toEqual(minsAgo(10));
    }
    expect(r.alert?.type).toBe('silent_machine');
  });

  test('silent past threshold, existing open downtime -> no action, no duplicate alert', () => {
    const r = detectDowntime({
      workcenterId: 1,
      lastPulseAt: minsAgo(30),
      openDowntime: { id: 5, startTime: minsAgo(20) },
      alertThresholdMin: 10,
      now
    });
    expect(r.action).toBe('none');
    expect(r.alert).toBeUndefined();
  });

  test('recent pulse with existing open downtime -> close', () => {
    const r = detectDowntime({
      workcenterId: 1,
      lastPulseAt: minsAgo(1),
      openDowntime: { id: 7, startTime: minsAgo(20) },
      alertThresholdMin: 10,
      now
    });
    expect(r.action).toMatchObject({ kind: 'close', id: 7 });
    expect(r.alert).toBeUndefined();
  });

  test('never produced, within startup grace -> open + alert', () => {
    const r = detectDowntime({ workcenterId: 1, lastPulseAt: null, openDowntime: null, alertThresholdMin: 10, now });
    expect(r.action).toMatchObject({ kind: 'open' });
    expect(r.alert?.type).toBe('silent_machine');
  });
});
