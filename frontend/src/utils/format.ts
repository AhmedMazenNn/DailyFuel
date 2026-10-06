import type { Language, WeightUnit } from '../types/nutrition';
import { localeFor } from './date';

export function formatNumber(n: number, lang: Language, maxFrac = 0): string {
  return new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: maxFrac }).format(n);
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** Accepts Western, Arabic-Indic and Persian digits plus "," or "٫" as decimal separator. */
export function normalizeDigits(value: string): string {
  return value.
  replace(/[٠-٩]/g, (c) => String(AR_DIGITS.indexOf(c))).
  replace(/[۰-۹]/g, (c) => String(FA_DIGITS.indexOf(c))).
  replace(/[٫,]/g, '.').
  trim();
}

/** Returns null for empty input, NaN for invalid input, otherwise the number. */
export function parseDecimal(value: string): number | null {
  const v = normalizeDigits(value);
  if (v === '') return null;
  if (v === '.' || !/^\d*\.?\d*$/.test(v)) return NaN;
  return Number(v);
}

export function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const LB_PER_KG = 2.20462;

export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg * LB_PER_KG;
}

export function unitToKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value / LB_PER_KG;
}

export function uid(): string {
  return crypto.randomUUID();
}