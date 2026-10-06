import React, { useRef, useState } from 'react';
import { CircleAlertIcon, ListIcon, LoaderCircleIcon, PlusIcon, Trash2Icon, XIcon, ZapIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { inputBase, inputBorder, primaryButton } from '../../utils/styles';
import type { Meal } from '../../types/nutrition';
import { NumberField } from '../ui/NumberField';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Sheet } from '../ui/Sheet';
import { useMealForm } from './useMealForm';

interface MealSheetProps {
  open: boolean;
  onClose: () => void;
  date: string;
  meal: Meal | null;
}

export function MealSheet({ open, onClose, date, meal }: MealSheetProps) {
  const { t, fmt, days, addMeal, updateMeal, deleteMeal, formatLong } = useApp();
  const defaultName = t('mealN', {n: days[date]?.nextMealNumber ?? 1});
  const key = useRef(crypto.randomUUID());
  const f = useMealForm(open, meal, defaultName);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saveError, setSaveError] = useState('');

  const close = () => {
    setConfirming(false);
    setSaveError('');
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const draft = f.validate();
    if (!draft) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      if (meal) await updateMeal(meal.id, draft);else
      await addMeal(date, draft, key.current);
      key.current = crypto.randomUUID();
      close();
    } catch (e) {
      setSaveError((e as Error).message || t('errSave'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!meal) return;
    setSaving(true);
    try { await deleteMeal(meal.id); close(); } catch(e) { setConfirming(false); setSaveError((e as Error).message); } finally { setSaving(false); }
  };

  const { form, errors } = f;

  const footer = confirming ?
  <div role="alertdialog" aria-label={t('deleteMeal')}>
      <p className="text-sm font-medium text-ink">{t('confirmDelete', { name: meal?.name ?? '' })}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setConfirming(false)} className="min-h-[48px] rounded-2xl bg-canvas text-sm font-semibold text-ink ring-1 ring-line hover:bg-brand-50">
          {t('keep')}
        </button>
        <button type="button" onClick={remove} disabled={saving} className="min-h-[48px] rounded-2xl bg-ink text-sm font-semibold text-white hover:bg-ink-soft disabled:opacity-60">
          {t('delete')}
        </button>
      </div>
    </div> :

  <div>
      {form.mode === 'itemized' &&
    <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-brand-50 px-4 py-2.5" aria-live="polite">
          <span className="text-sm font-semibold text-brand-900">{t('mealTotals')}</span>
          <span className="flex flex-wrap justify-end gap-x-3 text-sm tabular">
            <span className="font-bold text-ink">
              {fmt(f.itemTotals.calories)} {t('kcal')}
            </span>
            <span className="text-protein-ink">
              {t('protein')} {fmt(f.itemTotals.protein, 1)}
            </span>
            <span className="text-fat-ink">
              {t('fat')} {fmt(f.itemTotals.fat, 1)}
            </span>
          </span>
        </div>
    }
      {saveError &&
    <p role="alert" className="mb-3 flex items-center gap-1.5 text-sm font-medium text-red-700">
          <CircleAlertIcon className="h-4 w-4" aria-hidden />
          {saveError}
        </p>
    }
      <div className="flex gap-2">
        {meal &&
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={t('deleteMeal')}
        className="grid min-h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl bg-canvas text-ink-soft ring-1 ring-line transition-colors duration-150 hover:bg-red-50 hover:text-red-700">
        
            <Trash2Icon className="h-5 w-5" />
          </button>
      }
        <button type="submit" form="meal-form" disabled={saving} className={`${primaryButton} flex-1`}>
          {saving ? <LoaderCircleIcon className="h-5 w-5 animate-spin" aria-hidden /> : null}
          {saving ? t('saving') : t('saveMeal')}
        </button>
      </div>
    </div>;


  return (
    <Sheet open={open} onClose={() => {if(!saving) close();}} title={meal ? t('editMeal') : t('addMeal')} subtitle={formatLong(date)} footer={footer}>
      <form id="meal-form" onSubmit={submit} noValidate className="space-y-5">
        <div>
          <label htmlFor="meal-name" className="mb-1.5 block text-sm font-medium text-ink-soft">
            {t('mealName')}
          </label>
          <input
            id="meal-name"
            value={form.name}
            onChange={(e) => f.setField('name', e.target.value)}
            className={`${inputBase} ${inputBorder()} h-12 font-semibold`}
            autoComplete="off"
            enterKeyHint="next" />
          
        </div>

        <SegmentedControl
          label={t('entryMode')}
          size="lg"
          value={form.mode}
          onChange={f.setMode}
          options={[
          { value: 'quick', label: t('quick'), description: t('quickDesc'), icon: <ZapIcon className="h-4 w-4" aria-hidden /> },
          { value: 'itemized', label: t('itemized'), description: t('itemizedDesc'), icon: <ListIcon className="h-4 w-4" aria-hidden /> }]
          } />
        

        {form.mode === 'quick' ?
        <div className="space-y-4">
            <div>
              <label htmlFor="meal-note" className="mb-1.5 block text-sm font-medium text-ink-soft">
                {t('foodsNote')}
              </label>
              <textarea
              id="meal-note"
              rows={2}
              value={form.note}
              placeholder={t('foodsNotePh')}
              onChange={(e) => f.setField('note', e.target.value)}
              className={`${inputBase} ${inputBorder()} resize-none py-3`} />
            
            </div>
            <NumberField id="q-cal" label={t('calories')} suffix={t('kcal')} value={form.calories} onChange={(v) => f.setField('calories', v)} error={errors.calories} />
            <div className="grid grid-cols-2 gap-3">
              <NumberField id="q-protein" label={t('protein')} suffix={t('g')} value={form.protein} onChange={(v) => f.setField('protein', v)} error={errors.protein} />
              <NumberField id="q-fat" label={t('fat')} suffix={t('g')} value={form.fat} onChange={(v) => f.setField('fat', v)} error={errors.fat} />
            </div>
          </div> :

        <div className="space-y-3">
            <p className="text-xs text-ink-faint">{t('countedOnce')}</p>
            {errors.items &&
          <p role="alert" className="text-sm font-medium text-red-700">
                {errors.items}
              </p>
          }
            <ol className="space-y-3">
              {form.items.map((item, idx) =>
            <li key={item.id} className="rounded-2xl bg-canvas p-3 ring-1 ring-line">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <label htmlFor={`${item.id}-name`} className="sr-only">
                        {t('itemName')} {idx + 1}
                      </label>
                      <input
                    id={`${item.id}-name`}
                    value={item.name}
                    placeholder={t('itemNamePh')}
                    onChange={(e) => f.updateItem(item.id, 'name', e.target.value)}
                    aria-invalid={Boolean(errors[`${item.id}-name`])}
                    className={`${inputBase} ${inputBorder(errors[`${item.id}-name`])} h-12`} />
                  
                      {errors[`${item.id}-name`] && <p className="mt-1 text-xs font-medium text-red-700">{errors[`${item.id}-name`]}</p>}
                    </div>
                    <button type="button" disabled={idx === 0} onClick={() => f.moveItem(idx, -1)} aria-label={t('moveUp')} className="h-12 px-2 disabled:opacity-30">↑</button>
                    <button type="button" disabled={idx === form.items.length-1} onClick={() => f.moveItem(idx, 1)} aria-label={t('moveDown')} className="h-12 px-2 disabled:opacity-30">↓</button>
                    <button
                  type="button"
                  onClick={() => f.removeItem(item.id)}
                  aria-label={t('removeItem', { name: item.name || t('thisFood') })}
                  className="grid h-12 w-11 shrink-0 place-items-center rounded-xl text-ink-faint transition-colors duration-150 hover:bg-white hover:text-ink">
                  
                      <XIcon className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <NumberField compact id={`${item.id}-calories`} label={t('calories')} suffix={t('kcal')} value={item.calories} onChange={(v) => f.updateItem(item.id, 'calories', v)} error={errors[`${item.id}-calories`]} />
                    <NumberField compact id={`${item.id}-protein`} label={t('protein')} suffix={t('g')} value={item.protein} onChange={(v) => f.updateItem(item.id, 'protein', v)} error={errors[`${item.id}-protein`]} />
                    <NumberField compact id={`${item.id}-fat`} label={t('fat')} suffix={t('g')} value={item.fat} onChange={(v) => f.updateItem(item.id, 'fat', v)} error={errors[`${item.id}-fat`]} />
                  </div>
                </li>
            )}
            </ol>
            <button
            type="button"
            onClick={f.addItem}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-200 text-sm font-semibold text-brand-700 transition-colors duration-150 hover:bg-brand-50">
            
              <PlusIcon className="h-4 w-4" aria-hidden />
              {t('addItem')}
            </button>
          </div>
        }
      </form>
    </Sheet>);

}