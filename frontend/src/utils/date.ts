import type { Language } from '../types/nutrition';

export function localToday(timezone: string): string {
 const parts = new Intl.DateTimeFormat('en-CA', {timeZone: timezone, year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 return ['year','month','day'].map(key => parts.find(p => p.type === key)!.value).join('-');
}

export const TODAY = localToday(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Weeks start on Monday. */
export function weekStartOf(iso: string): string {
  const d = parseISO(iso);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return toISO(d);
}

export function localeFor(lang: Language): string {
  return lang === 'ar' ? 'ar-EG' : 'en-US';
}

export function formatDate(
iso: string,
lang: Language,
opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' })
: string {
  return new Intl.DateTimeFormat(localeFor(lang), opts).format(parseISO(iso));
}
