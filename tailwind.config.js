/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Night mode red colors for preserving night vision
        'night': {
          50: '#1a0000',
          100: '#2a0000',
          200: '#3a0000',
          300: '#4a0000',
          400: '#5a0000',
          500: '#6a0000',
          600: '#7a0000',
          700: '#8a0000',
          800: '#9a0000',
          900: '#aa0000',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}