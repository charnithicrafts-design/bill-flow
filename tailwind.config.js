/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        'amber-glow': '#F59E0B',
        'counter-dark': '#0A0A0F',
        'counter-surface': '#111118',
        'counter-border': '#1E1E2A',
        'success-green': '#10B981',
        'danger-red': '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
