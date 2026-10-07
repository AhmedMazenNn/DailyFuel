import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { parseDecimal, round1, uid } from '../../utils/format';
import type { EntryMode, Meal, MealDraft } from '../../types/nutrition';
import { mealItemDraft } from '../../utils/mealDraft';

export interface ItemDraft {
  id: string;
  name: string;
  calories: string;
  protein: string;
  carbohydrate: string;
  fat: string;
}

interface FormState {
  name: string;
  mode: EntryMode;
  note: string;
  calories: string;
  protein: string;
  carbohydrate: string;
  fat: string;
  items: ItemDraft[];
}

type Errors = Record<string, string>;

const str = (n: number) => String(n);
const emptyItem = (): ItemDraft => ({ id: uid(), name: '', calories: '', protein: '', carbohydrate: '', fat: '' });

function initial(meal: Meal | null, defaultName: string): FormState {
  if (!meal) return { name: defaultName, mode: 'quick', note: '', calories: '', protein: '', carbohydrate: '', fat: '', items: [emptyItem()] };
  return {
    name: meal.name,
    mode: meal.mode,
    note: meal.note,
    calories: String(meal.totals.calories),
    protein: str(meal.totals.protein),
    carbohydrate: str(meal.totals.carbohydrate),
    fat: str(meal.totals.fat),
    items: meal.items.length ?
    meal.items.map((i) => ({ id: i.id, name: i.name, calories: String(i.calories), protein: str(i.protein), carbohydrate: str(i.carbohydrate), fat: str(i.fat) })) :
    [emptyItem()]
  };
}

const safe = (v: string) => {
  const n = parseDecimal(v);
  return n === null || Number.isNaN(n) ? 0 : n;
};

export function useMealForm(open: boolean, meal: Meal | null, defaultName: string) {
  const { t } = useApp();
  const [form, setForm] = useState<FormState>(() => initial(meal, defaultName));
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (open) {
      setForm(initial(meal, defaultName));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meal]);

  const itemTotals = useMemo(
    () => ({
      calories: round1(form.items.reduce((a, i) => a + safe(i.calories), 0)),
      protein: round1(form.items.reduce((a, i) => a + safe(i.protein), 0)),
      carbohydrate: round1(form.items.reduce((a, i) => a + safe(i.carbohydrate), 0)),
      fat: round1(form.items.reduce((a, i) => a + safe(i.fat), 0))
    }),
    [form.items]
  );

  const clearError = (key: string) => setErrors((e) => e[key] ? { ...e, [key]: '' } : e);

  const setField = useCallback((key: 'name' | 'note' | 'calories' | 'protein' | 'carbohydrate' | 'fat', value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    clearError(key);
  }, []);

  const setMode = useCallback(
    (mode: EntryMode) => {
      setForm((f) => {
        if (mode === f.mode) return f;
        // Moving from itemized → quick: carry the computed totals so nothing is lost or double-counted.
        if (mode === 'quick' && !f.calories && itemTotals.calories > 0) {
          return {
            ...f,
            mode,
            calories: String(itemTotals.calories),
            protein: str(itemTotals.protein),
            carbohydrate: str(itemTotals.carbohydrate),
            fat: str(itemTotals.fat),
            note: f.note || f.items.filter((i) => i.name).map((i) => i.name).join(', ')
          };
        }
        return { ...f, mode };
      });
      setErrors({});
    },
    [itemTotals]
  );

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (id: string) => setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((i) => i.id !== id) : [emptyItem()] }));
  const updateItem = (id: string, key: keyof Omit<ItemDraft, 'id'>, value: string) => {
    setForm((f) => ({ ...f, items: f.items.map((i) => i.id === id ? { ...i, [key]: value } : i) }));
    clearError(`${id}-${key}`);
    clearError('items');
  };

  const validate = (): MealDraft | null => {
    const errs: Errors = {};
    const checkNum = (key: string, v: string, required: boolean) => {
      const n = parseDecimal(v);
      if (n === null) {
        if (required) errs[key] = t('errRequired');
        return 0;
      }
      if (Number.isNaN(n)) {
        errs[key] = t('errNumber');
        return 0;
      }
      return round1(n);
    };
    const name = form.name.trim() || defaultName;

    if (form.mode === 'quick') {
      const calories = checkNum('calories', form.calories, true);
      const protein = checkNum('protein', form.protein, false);
      const fat = checkNum('fat', form.fat, false);
      const carbohydrate = checkNum('carbohydrate', form.carbohydrate, false);
      setErrors(errs);
      if (Object.keys(errs).length) return null;
      return { name, mode: 'quick', note: form.note.trim(), totals: { calories, protein, carbohydrate, fat }, items: [] };
    }

    const filled = form.items.filter((i) => i.name.trim() || i.calories || i.protein || i.fat);
    if (!filled.length) {
      setErrors({ items: t('errNoItems') });
      return null;
    }
    const items = filled.map((i) => {
      if (!i.name.trim()) errs[`${i.id}-name`] = t('errItemName');
      return {
        id: i.id,
        name: i.name.trim(),
        calories: checkNum(`${i.id}-calories`, i.calories, true),
        protein: checkNum(`${i.id}-protein`, i.protein, false),
        carbohydrate: checkNum(`${i.id}-carbohydrate`, i.carbohydrate, false),
        fat: checkNum(`${i.id}-fat`, i.fat, false)
      };
    });
    setErrors(errs);
    if (Object.keys(errs).length) return null;
    // Itemized totals are always derived from items — the single source counted in the day.
    const totals = {
      calories: round1(items.reduce((a, i) => a + i.calories, 0)),
      protein: round1(items.reduce((a, i) => a + i.protein, 0)),
      carbohydrate: round1(items.reduce((a, i) => a + i.carbohydrate, 0)),
      fat: round1(items.reduce((a, i) => a + i.fat, 0))
    };
    return { name, mode: 'itemized', note: '', totals, items: items.map(item => mealItemDraft(item, meal?.items ?? [])) };
  };

  const moveItem = (index: number, delta: number) => setForm(f => {const items=[...f.items]; [items[index],items[index+delta]]=[items[index+delta],items[index]];return {...f,items};});
  return { form, errors, itemTotals, moveItem, setField, setMode, addItem, removeItem, updateItem, validate };
}
