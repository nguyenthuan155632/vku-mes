export interface DetectDowntimeInput {
  workcenterId: number;
  lastPulseAt: Date | null;
  openDowntime: { id: number; startTime: Date } | null;
  alertThresholdMin: number;
  now: Date;
}

export type DowntimeAction =
  | 'none'
  | { kind: 'open';  startTime: Date }
  | { kind: 'close'; id: number; endTime: Date };

export interface DetectDowntimeResult {
  action: DowntimeAction;
  alert?: { type: 'silent_machine'; message: string };
}

export function detectDowntime(i: DetectDowntimeInput): DetectDowntimeResult {
  const thresholdMs = i.alertThresholdMin * 60_000;
  const silentFor =
    i.lastPulseAt === null
      ? Number.POSITIVE_INFINITY
      : i.now.getTime() - i.lastPulseAt.getTime();

  const isSilent = silentFor >= thresholdMs;

  if (!isSilent && i.openDowntime) {
    return { action: { kind: 'close', id: i.openDowntime.id, endTime: i.now } };
  }
  if (isSilent && !i.openDowntime) {
    // Downtime is considered to have started `threshold` minutes ago from now,
    // i.e. when the silence threshold was crossed.
    const startTime = new Date(i.now.getTime() - thresholdMs);
    return {
      action: { kind: 'open', startTime },
      alert: { type: 'silent_machine', message: `Máy không có tín hiệu quá ${i.alertThresholdMin} phút` }
    };
  }
  return { action: 'none' };
}
