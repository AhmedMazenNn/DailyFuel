export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0B1B3A', soft: '#3A4B6A', faint: '#5E6E8A' },
        canvas: '#F2F6FC',
        line: '#E1E8F2',
        brand: {
          50: '#EEF4FF',
          100: '#DCE8FF',
          200: '#B8D2FF',
          400: '#5B8CFF',
          500: '#2F6BFF',
          600: '#1F55E6',
          700: '#1A44B8',
          900: '#0E2A6E',
        },
        aqua: { 400: '#22D3EE', 500: '#06B6D4' },
        zest: { 200: '#ECFCCB', 300: '#D9F99D', 400: '#C2F04A', 500: '#A3D92E', 700: '#4D6B0A' },
        protein: { DEFAULT: '#14B8A6', ink: '#0B7468', soft: '#DDF5F1' },
        fat: { DEFAULT: '#F59E0B', ink: '#935600', soft: '#FDF0D9' },
      },
      fontFamily: {
        sans: ['Inter', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        display: ['Manrope', '"IBM Plex Sans Arabic"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,27,58,0.04), 0 10px 28px -16px rgba(11,27,58,0.18)',
        hero: '0 28px 56px -24px rgba(31,85,230,0.6)',
        float: '0 12px 28px -8px rgba(11,27,58,0.35)',
      },
    },
  },
};
