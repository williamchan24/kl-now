/** Time helpers. Everything is in Kuala Lumpur time, wherever the visitor is. */

export const KL_TZ = 'Asia/Kuala_Lumpur';

/** Current KL time as a decimal hour, e.g. 19.5 = 7:30 pm */
export function klHour(date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: KL_TZ,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get('hour') + get('minute') / 60 + get('second') / 3600;
}

/** 19.5 → "7:30 pm" */
export function formatHour(h: number): string {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h - Math.floor(h)) * 60 + 1e-6);
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'}`;
}

/** 15 → "3pm" (for the hourly strip) */
export function shortHour(h: number): string {
  const hh = Math.floor(h) % 24;
  return `${hh % 12 || 12}${hh < 12 ? 'am' : 'pm'}`;
}

/** "2026-10-12T19:08" → 19.133 (the time part only; Open-Meteo already gives KL local time) */
export function isoToHour(iso: string): number {
  const t = iso.split('T')[1] ?? '00:00';
  return Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60;
}

/** 12.08 → "12h 5m" */
export function formatDuration(hours: number): string {
  const totalMin = Math.round(hours * 60);
  return `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`;
}
