import React from 'react';
import { BrandMark } from '../layout/BrandMark';

interface PageHeaderProps {
  title: string;
  intro?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, intro, action }: PageHeaderProps) {
  return (
    <header className="mb-5 lg:mb-8">
      <div className="mb-4 lg:hidden">
        <BrandMark />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
          {intro && <p className="mt-1 max-w-xl text-sm text-ink-soft">{intro}</p>}
        </div>
        {action}
      </div>
    </header>);

}