import React, { useEffect, useState } from 'react';
import { LoaderCircleIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { parseDecimal, round1 } from '../../utils/format';
import { primaryButton } from '../../utils/styles';
import type { Targets } from '../../types/nutrition';
import { NumberField } from '../ui/NumberField';

interface TargetsFormProps {
  idPrefix: string;
  initial: Targets;
  onSave: (targets: Targets) => Promise<void>;
  formId?: string;
  hideSubmit?: boolean;
  onSavingChange?: (saving: boolean) => void;
}

export function TargetsForm({ idPrefix, initial, onSave, formId, hideSubmit, onSavingChange }: TargetsFormProps) {
  const { t } = useApp();
  const [values, setValues] = useState({ calories: String(initial.calories), protein: String(initial.protein), fat: String(initial.fat) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error,setError] = useState('');

  useEffect(() => {
    setValues({ calories: String(initial.calories), protein: String(initial.protein), fat: String(initial.fat) });
    setErrors({});
  }, [initial]);

  const set = (key: keyof typeof values, v: string) => {
    setValues((s) => ({ ...s, [key]: v }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const out = {} as Targets;
    (Object.keys(values) as (keyof Targets)[]).forEach((k) => {
      const n = parseDecimal(values[k]);
      if (n === null) errs[k] = t('errRequired');else
      if (Number.isNaN(n)) errs[k] = t('errNumber');else
      out[k] = round1(n);
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    onSavingChange?.(true);
    setError('');
    try {await onSave(out);} catch(e) {setError((e as Error).message);} finally {setSaving(false);onSavingChange?.(false);}
  };

  return (
    <form id={formId} onSubmit={submit} noValidate className="space-y-3">
      <NumberField id={`${idPrefix}-cal`} label={t('calories')} suffix={t('kcal')} value={values.calories} onChange={(v) => set('calories', v)} error={errors.calories} />
      <div className="grid grid-cols-2 gap-3">
        <NumberField id={`${idPrefix}-p`} label={t('protein')} suffix={t('g')} value={values.protein} onChange={(v) => set('protein', v)} error={errors.protein} />
        <NumberField id={`${idPrefix}-f`} label={t('fat')} suffix={t('g')} value={values.fat} onChange={(v) => set('fat', v)} error={errors.fat} />
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!hideSubmit &&
      <button type="submit" disabled={saving} className={`${primaryButton} w-full`}>
          {saving && <LoaderCircleIcon className="h-5 w-5 animate-spin" aria-hidden />}
          {saving ? t('saving') : t('saveTargets')}
        </button>
      }
    </form>);

}