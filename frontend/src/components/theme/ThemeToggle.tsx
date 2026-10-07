import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

export function ThemeToggle({ language = "en" }: { language?: string }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const label = language === "ar" ? "الوضع الداكن" : "Dark mode";
  const Icon = dark ? MoonIcon : SunIcon;
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={dark}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink shadow-card transition-colors hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}
