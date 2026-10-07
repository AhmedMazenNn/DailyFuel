import React, { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingUpIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { formatDate } from '../../utils/date';
import { kgToUnit, round1 } from '../../utils/format';
import { card } from '../../utils/styles';

export function WeightChart() {
  const { weekly, settings, t, fmt, lang, dir, reduceMotion } = useApp();
  const unit = settings.weightUnit;
  const rtl = dir === 'rtl';

  const data = useMemo(
    () =>
    Object.values(weekly).
    filter((w) => w.weightKg !== null).
    sort((a, b) => a.weekStart.localeCompare(b.weekStart)).
    map((w) => ({
      week: w.weekStart,
      label: formatDate(w.weekStart, lang, { month: 'short', day: 'numeric' }),
      value: round1(kgToUnit(w.weightKg as number, unit))
    })),
    [weekly, unit, lang]
  );

  return (
    <section aria-labelledby="trend-heading" className={`${card} p-5`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="trend-heading" className="font-display text-lg font-bold text-ink">
          {t('trend')}
        </h2>
        <span className="text-xs font-medium text-ink-faint">{t(unit)}</span>
      </div>

      {data.length < 2 ?
      <div className="mt-4 flex flex-col items-center rounded-2xl bg-canvas px-6 py-10 text-center">
          <TrendingUpIcon className="h-6 w-6 text-brand-500" aria-hidden />
          <p className="mt-2 max-w-xs text-sm text-ink-soft">{t('noTrend')}</p>
        </div> :

      <>
          <div className="mt-4 h-56" aria-hidden dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: rtl ? 0 : 8, left: rtl ? 8 : 0, bottom: 0 }}>
                <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
                <XAxis dataKey="label" reversed={rtl} tick={{ fill: 'rgb(var(--ink-faint))', fontSize: 12 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis
                orientation={(rtl ? 'right' : 'left') as any}
                domain={['dataMin - 1', 'dataMax + 1']}
                width={44}
                tick={{ fill: 'rgb(var(--ink-faint))', fontSize: 12 }}
                tickFormatter={(v: number) => fmt(v, 0)}
                axisLine={false}
                tickLine={false} />

                <Tooltip
                formatter={(v: any) => [`${fmt(Number(v), 1)} ${t(unit)}`, t('weightUnit')]}
                contentStyle={{ backgroundColor: 'rgb(var(--surface))', color: 'rgb(var(--ink))', borderRadius: 12, border: '1px solid rgb(var(--line))', boxShadow: '0 10px 28px -16px rgba(11,27,58,0.25)', direction: dir as any }}
                labelStyle={{ color: 'rgb(var(--ink))', fontWeight: 600 }} />

                <Line
                type="monotone"
                dataKey="value"
                stroke="#2F6BFF"
                strokeWidth={3}
                dot={{ r: 4, fill: 'rgb(var(--surface))', stroke: '#2F6BFF', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#2F6BFF' }}
                isAnimationActive={!reduceMotion}
                animationDuration={300} />

              </LineChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>{t('trend')}</caption>
            <tbody>
              {data.map((d) =>
            <tr key={d.week}>
                  <th scope="row">{d.label}</th>
                  <td>
                    {fmt(d.value, 1)} {t(unit)}
                  </td>
                </tr>
            )}
            </tbody>
          </table>
        </>
      }
    </section>);

}
