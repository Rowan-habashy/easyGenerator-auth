/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#eef0ff', 100: '#e0e3ff', 500: '#5b5bf0', 600: '#4646d6', 700: '#3a3ab8' },
      },
      boxShadow: { card: '0 10px 30px rgba(40, 40, 120, 0.12)' },
    },
  },
  plugins: [],
}
