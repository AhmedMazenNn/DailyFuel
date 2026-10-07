import { useState } from 'react';
import { InfoIcon, LoaderCircleIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { primaryButton } from '../../utils/styles';
import { Sheet } from '../ui/Sheet';
import { TargetsForm } from './TargetsForm';

interface TargetsSheetProps {
  open: boolean;
  onClose: () => void;
  date: string;
}

export function TargetsSheet({ open, onClose, date }: TargetsSheetProps) {
  const { t, getTargets, setTargets, formatLong } = useApp();
  const [saving, setSaving] = useState(false);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('targetsFor', { date: formatLong(date) })}
      footer={
      <button type="submit" form="targets-sheet-form" disabled={saving} className={`${primaryButton} w-full`}>
          {saving && <LoaderCircleIcon className="h-5 w-5 animate-spin" aria-hidden />}
          {saving ? t('saving') : t('saveTargets')}
        </button>
      }>
      
      <TargetsForm
        idPrefix="sheet"
        formId="targets-sheet-form"
        hideSubmit
        initial={getTargets(date)}
        onSavingChange={setSaving}
        onSave={async (targets) => {
          await setTargets(date, targets);
          onClose();
        }} />
      
      <p className="mt-4 flex gap-2 rounded-2xl bg-brand-50 p-3 text-xs leading-relaxed text-brand-900">
        <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {t('targetsCarry')}
      </p>
    </Sheet>);

}