import React, { useMemo, useState } from 'react';
import { Columns2Icon, ImageIcon, LayoutGridIcon, LockIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { formatDate } from '../../utils/date';
import { card, inputBase, inputBorder } from '../../utils/styles';
import { SegmentedControl } from '../ui/SegmentedControl';

type View = 'gallery' | 'compare';

export function PhotoGallery() {
  const { weekly, t, fmt, lang } = useApp();
  const [view, setView] = useState<View>('gallery');
  const weeks = useMemo(
    () => Object.values(weekly).filter((w) => w.photos.length > 0).sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
    [weekly]
  );
  const [aWeek, setAWeek] = useState<string | null>(null);
  const [bWeek, setBWeek] = useState<string | null>(null);
  const a = weeks.find((w) => w.weekStart === aWeek) ?? weeks[weeks.length - 1];
  const b = weeks.find((w) => w.weekStart === bWeek) ?? weeks[0];
  const weekLabel = (iso: string) => t('weekOf', { date: formatDate(iso, lang, { month: 'short', day: 'numeric', year: 'numeric' }) });

  return (
    <section aria-labelledby="gallery-heading" className={`${card} p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="gallery-heading" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          {t('gallery')}
          <LockIcon className="h-4 w-4 text-ink-faint" aria-label={t('privacyTitle')} />
        </h2>
        {weeks.length > 0 &&
        <div className="w-full sm:w-64">
            <SegmentedControl
            label={t('gallery')}
            value={view}
            onChange={setView}
            options={[
            { value: 'gallery', label: t('galleryView'), icon: <LayoutGridIcon className="h-4 w-4" aria-hidden /> },
            { value: 'compare', label: t('compareView'), icon: <Columns2Icon className="h-4 w-4" aria-hidden /> }]
            } />

          </div>
        }
      </div>

      {weeks.length === 0 ?
      <div className="mt-4 flex flex-col items-center rounded-2xl bg-canvas px-6 py-10 text-center">
          <ImageIcon className="h-6 w-6 text-brand-500" aria-hidden />
          <p className="mt-2 max-w-sm text-sm text-ink-soft">{t('noPhotos')}</p>
        </div> :
      view === 'gallery' ?
      <ul className="mt-4 space-y-5">
          {weeks.map((w) =>
        <li key={w.weekStart}>
              <h3 className="text-sm font-semibold text-ink-soft">{weekLabel(w.weekStart)}</h3>
              <ul className="mt-2 grid grid-cols-4 gap-2">
                {w.photos.map((p, i) =>
            <li key={p.id} className="aspect-[3/4] overflow-hidden rounded-2xl bg-canvas ring-1 ring-line">
                    <img src={p.url} alt={`${weekLabel(w.weekStart)} · ${t('photoN', { n: fmt(i + 1) })}`} className="h-full w-full object-cover" loading="lazy" />
                  </li>
            )}
              </ul>
            </li>
        )}
        </ul> :
      weeks.length < 2 ?
      <p className="mt-4 rounded-2xl bg-canvas px-5 py-8 text-center text-sm text-ink-soft">{t('needTwoWeeks')}</p> :

      <div className="mt-4">
          <p className="text-sm text-ink-soft">{t('compareWeeks')}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[
          { id: 'cmp-a', label: t('weekA'), value: a.weekStart, set: setAWeek },
          { id: 'cmp-b', label: t('weekB'), value: b.weekStart, set: setBWeek }].
          map((s) =>
          <div key={s.id} className="min-w-0">
                <label htmlFor={s.id} className="mb-1.5 block text-xs font-semibold text-ink-faint">
                  {s.label}
                </label>
                <select id={s.id} value={s.value} onChange={(e) => s.set(e.target.value)} className={`${inputBase} ${inputBorder()} h-12 truncate pe-8 text-sm`}>
                  {weeks.map((w) =>
              <option key={w.weekStart} value={w.weekStart}>
                      {formatDate(w.weekStart, lang, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </option>
              )}
                </select>
              </div>
          )}
          </div>
          <ul className="mt-4 space-y-3">
            {Array.from({ length: Math.max(a.photos.length, b.photos.length) }).map((_, i) =>
          <li key={i} className="grid grid-cols-2 gap-3">
                {[a, b].map((w, col) => {
              const p = w.photos[i];
              return (
                <div key={col} className="aspect-[3/4] overflow-hidden rounded-2xl bg-canvas ring-1 ring-line">
                      {p ?
                  <img src={p.url} alt={`${weekLabel(w.weekStart)} · ${t('photoN', { n: fmt(i + 1) })}`} className="h-full w-full object-cover" /> :

                  <div className="grid h-full place-items-center text-xs text-ink-faint">{t('noPhotoSlot')}</div>
                  }
                    </div>);

            })}
              </li>
          )}
          </ul>
        </div>
      }
    </section>);

}