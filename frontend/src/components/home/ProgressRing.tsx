import React from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../contexts/AppContext';

interface ProgressRingProps {
  ratio: number;
  children: React.ReactNode;
  className?: string;
}

const R = 86;
const C = 2 * Math.PI * R;
const EASE = [0.23, 1, 0.32, 1] as const;

export function ProgressRing({ ratio, children, className = '' }: ProgressRingProps) {
  const { reduceMotion, dir } = useApp();
  const main = Math.max(0, Math.min(ratio, 1));
  const over = Math.max(0, Math.min(ratio - 1, 1));
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.3, ease: EASE };

  return (
    <div className={`relative aspect-square ${className}`}>
      <svg
        viewBox="0 0 200 200"
        className="absolute inset-0 h-full w-full"
        style={{ transform: dir === 'rtl' ? 'scaleX(-1) rotate(-90deg)' : 'rotate(-90deg)' }}
        aria-hidden>
        
        <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="14" />
        <motion.circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - main) }}
          transition={transition} />
        
        {over > 0 &&
        <motion.circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke="#0B1B3A"
          strokeOpacity="0.38"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - over) }}
          transition={transition} />

        }
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>);

}