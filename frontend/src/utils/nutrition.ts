import type { Macros, Meal, Targets } from '../types/nutrition';
import { round1 } from './format';

export const ZERO_MACROS: Macros = { calories: 0, protein: 0, carbohydrate: 0, fat: 0 };

export function sumMacros(list: Macros[]): Macros {
  return list.reduce<Macros>(
    (acc, m) => ({
      calories: round1(acc.calories + m.calories),
      protein: round1(acc.protein + m.protein),
      carbohydrate: round1(acc.carbohydrate + m.carbohydrate),
      fat: round1(acc.fat + m.fat)
    }),
    ZERO_MACROS
  );
}

export function mealsForDate(meals: Meal[], date: string): Meal[] {
  return meals.filter((m) => m.date === date).sort((a, b) => a.position - b.position);
}

/** A date uses its own targets, otherwise inherits the most recent earlier date's targets. */
export function resolveTargets(map: Record<string, Targets>, date: string, fallback: Targets): Targets {
  if (map[date]) return map[date];
  const prior = Object.keys(map).
  filter((d) => d < date).
  sort();
  return prior.length ? map[prior[prior.length - 1]] : fallback;
}

export function nextMealName(dayMeals: Meal[], makeName: (n: number) => string): string {
  const names = new Set(dayMeals.map((m) => m.name));
  let n = dayMeals.length + 1;
  while (names.has(makeName(n))) n += 1;
  return makeName(n);
}
