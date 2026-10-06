import { useEffect, useRef, useState } from 'react';

/** Animates a number toward `value`. Snaps instantly when motion is reduced. */
export function useCountUp(value: number, reduce: boolean, duration = 300): number {
  const [display, setDisplay] = useState(reduce ? value : 0);
  const fromRef = useRef(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (value - from) * eased;
      setDisplay(v);
      fromRef.current = v;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce, duration]);

  return display;
}