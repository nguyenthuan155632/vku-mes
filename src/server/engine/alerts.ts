export interface CheckLowOutputInput {
  workcenterId: number;
  lastHourQty: number;
  targetQtyPerHour: number;
  thresholdPct: number;
  hasOpenAlert: boolean;
}

export interface CheckLowOutputResult {
  alert?: { type: 'low_output'; message: string };
}

export function checkLowOutput(i: CheckLowOutputInput): CheckLowOutputResult {
  if (i.targetQtyPerHour === 0) return {};
  if (i.hasOpenAlert) return {};
  const threshold = (i.targetQtyPerHour * i.thresholdPct) / 100;
  if (i.lastHourQty < threshold) {
    return {
      alert: {
        type: 'low_output',
        message: `Sản lượng 1 giờ gần nhất (${i.lastHourQty}) thấp hơn ${i.thresholdPct}% mục tiêu (${Math.round(threshold)})`
      }
    };
  }
  return {};
}
