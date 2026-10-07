import React from 'react';

interface Option<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'md' | 'lg';
}

export function SegmentedControl<T extends string>({ label, options, value, onChange, size = 'md' }: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-2xl bg-canvas p-1 ring-1 ring-line" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`flex min-h-[44px] flex-col items-center justify-center rounded-xl px-2 text-center transition-[background-color,color,box-shadow] duration-150 ${
            size === 'lg' ? 'py-2.5' : 'py-1.5'} ${
            active ? 'bg-white text-ink shadow-card ring-1 ring-brand-200' : 'text-ink-soft hover:text-ink'}`}>
            
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              {o.icon}
              {o.label}
            </span>
            {o.description && <span className="mt-0.5 text-xs leading-snug text-ink-faint">{o.description}</span>}
          </button>);

      })}
    </div>);

}