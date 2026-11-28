/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070B14',
          900: '#0B1120',
          850: '#0F172A',
          800: '#111827',
          700: '#1E293B',
          600: '#273549',
        },
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px -4px rgba(99, 102, 241, 0.35)',
        card: '0 8px 30px rgba(0, 0, 0, 0.28)',
      },
    },
  },
  plugins: [],
};
