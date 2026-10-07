export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          soft: "rgb(var(--ink-soft) / <alpha-value>)",
          faint: "rgb(var(--ink-faint) / <alpha-value>)",
        },
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        brand: {
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "rgb(var(--brand-200) / <alpha-value>)",
          400: "#5B8CFF",
          500: "#2F6BFF",
          600: "#1F55E6",
          700: "rgb(var(--brand-700) / <alpha-value>)",
          900: "rgb(var(--brand-900) / <alpha-value>)",
        },
        aqua: { 400: "#22D3EE", 500: "#06B6D4" },
        zest: {
          200: "#ECFCCB",
          300: "#D9F99D",
          400: "#C2F04A",
          500: "#A3D92E",
          700: "#4D6B0A",
        },
        protein: {
          DEFAULT: "#14B8A6",
          ink: "rgb(var(--protein-ink) / <alpha-value>)",
          soft: "rgb(var(--protein-soft) / <alpha-value>)",
        },
        fat: {
          DEFAULT: "#F59E0B",
          ink: "rgb(var(--fat-ink) / <alpha-value>)",
          soft: "rgb(var(--fat-soft) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["Inter", '"IBM Plex Sans Arabic"', "system-ui", "sans-serif"],
        display: [
          "Manrope",
          '"IBM Plex Sans Arabic"',
          "Inter",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,27,58,0.04), 0 10px 28px -16px rgba(11,27,58,0.18)",
        hero: "0 28px 56px -24px rgba(31,85,230,0.6)",
        float: "0 12px 28px -8px rgba(11,27,58,0.35)",
      },
    },
  },
};
