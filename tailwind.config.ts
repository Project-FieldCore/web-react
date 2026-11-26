import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0F2444',
          800: '#16305A',
          700: '#1F4E79',
          600: '#2E5F8C',
        },
        brandgreen: {
          600: '#3E8E37',
          500: '#5CA83F',
        },
      },
    },
  },
  plugins: [],
};
export default config;
