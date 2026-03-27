import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors — will be overridden by tenant CSS variables
        brand: {
          50: 'var(--brand-50, #fdf4ff)',
          100: 'var(--brand-100, #fae8ff)',
          200: 'var(--brand-200, #f5d0fe)',
          300: 'var(--brand-300, #f0abfc)',
          400: 'var(--brand-400, #e879f9)',
          500: 'var(--brand-500, #d946ef)',
          600: 'var(--brand-600, #c026d3)',
          700: 'var(--brand-700, #a21caf)',
          800: 'var(--brand-800, #86198f)',
          900: 'var(--brand-900, #701a75)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
