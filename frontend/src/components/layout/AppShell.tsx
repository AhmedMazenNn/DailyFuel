import React, { useEffect } from 'react';
import { Toaster } from 'sonner';
import { useApp } from '../../contexts/AppContext';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';

export function AppShell({ children }: {children: React.ReactNode;}) {
  const { dir, lang, settings } = useApp();

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('dir', dir);
    root.setAttribute('lang', lang);
    root.style.fontSize = settings.textSize === 'large' ? '112.5%' : '100%';
  }, [dir, lang, settings.textSize]);

  return (
    <div dir={dir} className="app-backdrop flex min-h-screen w-full font-sans text-ink">
      <SideNav />
      <main className="min-w-0 flex-1 pb-28 lg:pb-12">
        <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pt-10">{children}</div>
      </main>
      <BottomNav />
      <Toaster
        position="top-center"
        dir={dir}
        offset={16}
        toastOptions={{
          className: 'font-sans !rounded-2xl !border-line !shadow-card'
        }} />
      
    </div>);

}