import React, { useEffect } from "react";
import { Toaster } from "sonner";
import { useApp } from "../../contexts/AppContext";
import { ThemeToggle } from "../theme/ThemeToggle";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { Link } from "react-router-dom";
import { ShieldIcon } from "lucide-react";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const { session } = useAuth();
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
          <div className="mb-4 flex items-center justify-end gap-3">
            {session?.user?.isAdmin && (
              <Link to="/manage-users" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-50 px-3 text-sm font-semibold text-brand-700 hover:bg-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">
                <ShieldIcon className="h-4 w-4" aria-hidden />
                {lang === "ar" ? "لوحة الإدارة" : "Admin panel"}
              </Link>
            )}
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
