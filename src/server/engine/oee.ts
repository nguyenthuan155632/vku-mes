export interface OeeInput {
  shiftLengthMin: number;
  runtimeMin: number;
  totalQty: number;
  defectQty: number;
  targetQtyPerHour: number;
}

export interface OeeResult {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function computeOEE(i: OeeInput): OeeResult {
  const availability = i.shiftLengthMin > 0 ? clamp01(i.runtimeMin / i.shiftLengthMin) : 0;

  let performance = 0;
  if (i.runtimeMin > 0 && i.targetQtyPerHour > 0) {
    const expected = (i.targetQtyPerHour * i.runtimeMin) / 60;
    performance = clamp01(i.totalQty / expected);
  }

  const quality = i.totalQty === 0 ? 1 : clamp01((i.totalQty - i.defectQty) / i.totalQty);

  return { availability, performance, quality, oee: availability * performance * quality };
}
