export type EntryMode = 'quick' | 'itemized';
export type Language = 'en' | 'ar';
export type WeightUnit = 'kg' | 'lb';
export type TextSize = 'default' | 'large';

export interface Macros {
  calories: number;
  protein: number;
  fat: number;
}

export type Targets = Macros;

export interface FoodItem extends Macros {
  id: string;
  name: string;
}

export interface Meal {
  id: string;
  date: string;
  name: string;
  mode: EntryMode;
  /** Free-text list of foods (quick entry). Itemized meals derive their summary from items. */
  note: string;
  /** Always the single source of truth for daily totals. For itemized meals it equals the sum of items. */
  totals: Macros;
  items: FoodItem[];
  createdAt: string;
}

export interface MealDraft {
  name: string;
  mode: EntryMode;
  note: string;
  totals: Macros;
  items: FoodItem[];
}

export interface ProgressPhoto {
  id: string;
  url: string;
}

export interface WeeklyRecord {
  weekStart: string;
  weightKg: number | null;
  photos: ProgressPhoto[];
}

export interface Settings {
  timezone: string;
  onboardingComplete: boolean;
  initialTargets: Targets;
  name: string;
  email: string;
  language: Language;
  weightUnit: WeightUnit;
  textSize: TextSize;
  reduceMotion: boolean;
  showRewards: boolean;
}
export interface Day {date: string; targets: Targets; totals: Macros; remaining: Macros; meals: Meal[]; nextMealNumber: number}
