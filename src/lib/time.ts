/** Time helpers. Everything is shown in the CITY's local time, wherever the visitor is. */

/** Current time in a timezone as a decimal hour, e.g. 19.5 = 7:30 pm */
export function cityHour(tz: string, date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(date);
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

/** "2026-10-12T19:08" → 19.133 (the time part only; Open-Meteo already gives local time) */
export function isoToHour(iso: string): number {
  const t = iso.split('T')[1] ?? '00:00';
  return Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60;
}

/** 12.08 → "12h 5m" */
export function formatDuration(hours: number): string {
  const totalMin = Math.round(hours * 60);
  return `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`;
}

/**
 * The sky colours were designed around KL's day (sunrise ~7:03, sunset ~7:08 pm).
 * Other cities' days are different lengths (Melbourne: 5:30 am–8:45 pm in summer!),
 * so this maps a local hour onto the same point of a "KL-shaped" day.
 * e.g. Melbourne sunset at 19:40 → 19.13, so the sky is golden at the right moment.
 */
export const REF_SUNRISE = 7.05;
export const REF_SUNSET = 19.13;
export function solarHour(h: number, sunrise: number, sunset: number): number {
  const TW = 1.5; // twilight either side, in hours
  // anchors: [local hour, reference hour], walking once around the clock from sunrise
  const a: [number, number][] = [
    [sunrise - TW, REF_SUNRISE - TW],
    [sunrise, REF_SUNRISE],
    [sunset, REF_SUNSET],
    [sunset + TW, REF_SUNSET + TW],
    [sunrise - TW + 24, REF_SUNRISE - TW + 24],
  ];
  let x = h;
  while (x < a[0][0]) x += 24;
  while (x >= a[4][0]) x -= 24;
  for (let i = 0; i < 4; i++) {
    const [x0, y0] = a[i], [x1, y1] = a[i + 1];
    if (x >= x0 && x < x1) return (((y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)) % 24) + 24) % 24;
  }
  return h;
}
