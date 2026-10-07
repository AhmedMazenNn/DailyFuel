import React, { useEffect } from "react";
import { Toaster } from "sonner";
import { useApp } from "../../contexts/AppContext";
import { ThemeToggle } from "../theme/ThemeToggle";
import { useTheme } from "../../contexts/ThemeContext";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const { dir, lang, settings } = useApp();

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("dir", dir);
    root.setAttribute("lang", lang);
    root.dataset.reduceMotion = String(settings.reduceMotion);
    root.style.fontSize = settings.textSize === "large" ? "112.5%" : "100%";
  }, [dir, lang, settings.textSize, settings.reduceMotion]);

  return (
    <div
      dir={dir}
      className="app-backdrop flex min-h-screen w-full font-sans text-ink"
    >
      <SideNav />
      <main className="min-w-0 flex-1 pb-28 lg:pb-12">
        <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pt-10">
          <div className="mb-4 flex justify-end">
            <ThemeToggle language={lang} />
          </div>
          {children}
        </div>
      </main>
      <BottomNav />
      <Toaster
        theme={theme}
        position="top-center"
        dir={dir as "ltr" | "rtl"}
        offset={16}
        toastOptions={{
          className: "font-sans !rounded-2xl !border-line !shadow-card",
        }}
      />
    </div>
  );
}
