
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Manual toggle
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Native-like neutrals
        window: {
          light: '#f5f5f5',
          dark: '#18181b', // zinc-950
        },
        panel: {
          light: '#ffffff',
          dark: '#27272a', // zinc-800
        },
        border: {
          light: '#e5e7eb', // gray-200
          dark: '#3f3f46', // zinc-700
        }
      },
      fontSize: {
        'xxs': '0.65rem',
      },
      boxShadow: {
        'window': '0 10px 40px -10px rgba(0, 0, 0, 0.5)',
      }
    },
  },
  plugins: [],
}
