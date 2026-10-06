import { CircleAlertIcon } from 'lucide-react';
import { inputBase, inputBorder } from '../../utils/styles';

interface NumberFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  error?: string;
  placeholder?: string;
  compact?: boolean;
  srOnlyLabel?: boolean;
}

export function NumberField({ id, label, value, onChange, suffix, error, placeholder = '0', compact, srOnlyLabel }: NumberFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={srOnlyLabel ? 'sr-only' : 'mb-1.5 block text-sm font-medium text-ink-soft'}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="next"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`${inputBase} ${inputBorder(error)} tabular ${compact ? 'h-12 pe-9 ps-3' : 'h-14 pe-14 text-lg font-semibold'}`} />
        
        {suffix &&
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-ink-faint">{suffix}</span>
        }
      </div>
      {error &&
      <p id={errorId} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-700">
          <CircleAlertIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      }
    </div>);

}