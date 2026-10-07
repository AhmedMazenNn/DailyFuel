export const inputBase =
'block w-full rounded-2xl border bg-white px-4 text-base text-ink placeholder:text-ink-faint/70 outline-none transition-[border-color,box-shadow] duration-150 focus:border-brand-500 focus:ring-4 focus:ring-brand-100';

export const inputBorder = (error?: string) => error ? 'border-red-500' : 'border-line';

export const primaryButton =
'inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-zest-400 px-5 text-base font-semibold text-ink shadow-[0_8px_20px_-10px_rgba(77,107,10,0.6)] transition-[background-color,transform] duration-150 hover:bg-zest-500 active:scale-[0.98] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

export const secondaryButton =
'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-brand-50 px-4 text-sm font-semibold text-brand-700 transition-[background-color,transform] duration-150 hover:bg-brand-100 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

export const card = 'rounded-3xl bg-white shadow-card ring-1 ring-line';