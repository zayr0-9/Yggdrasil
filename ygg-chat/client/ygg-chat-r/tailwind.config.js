/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // optional: keep Inter alias
        inter: ['Inter', 'sans-serif'],
        // default sans will be DM Sans with sensible fallbacks
        sans: ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
        // optional: dedicated utility
        dm: ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        primary: '#1E1E1E',
        secondary: '#1E1E1E',

        col1: {
          50: '#a67899',
          100: '#976288',
          200: '#884B77',
          300: '#793566',
          400: '#6a1e55',
          500: '#5f1b4d',
          600: '#551844',
          700: '#4a153b',
          800: '#401233',
          900: '#350f2b',
        },
      },
    },
  },
  plugins: [],
}
