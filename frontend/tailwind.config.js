/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FF6B6B',
        secondary: '#4ECDC4',
        wedding: {
          red: '#E63946',
          pink: '#FFB6C1',
          gold: '#FFD700',
        }
      }
    },
  },
  plugins: [],
}
