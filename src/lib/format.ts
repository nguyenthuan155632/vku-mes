import { formatInTimeZone } from 'date-fns-tz';

const VN_TZ = 'Asia/Ho_Chi_Minh';
const nf = new Intl.NumberFormat('vi-VN');

export const fmtNum = (n: number) => nf.format(n);
export const fmtPct = (x: number) => `${Math.round(x * 100)}%`;
export const fmtClock = (d: Date) => formatInTimeZone(d, VN_TZ, 'HH:mm:ss • dd/MM/yyyy');
export const fmtShort = (d: Date | string) => formatInTimeZone(new Date(d), VN_TZ, 'HH:mm dd/MM');
export const fmtDuration = (mins: number | null) => {
  if (mins == null) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}g ${m}p` : `${m}p`;
};
