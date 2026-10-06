

export function BrandMark() {

  return (
    <div className="flex items-center gap-2.5">
      <span className="brand-mark grid h-9 w-9 place-items-center rounded-xl text-white shadow-hero" aria-hidden>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M12 4a8 8 0 1 1-7.4 5" />
          <path d="M12 8v4l2.5 2" />
        </svg>
      </span>
      <span className="font-display text-lg font-extrabold tracking-tight text-ink" dir="ltr">
        DailyFuel
      </span>
    </div>);

}