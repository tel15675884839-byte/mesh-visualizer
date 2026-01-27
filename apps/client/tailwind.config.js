
/** @type {import('tailwindcss').Config} */
module.exports = {
  // darkMode removed - strictly light
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic names mapped to Light colors directly
        window: '#f3f4f6', // gray-100 (App Background)
        panel: '#ffffff',  // white (Sidebar/Modals)
        border: '#e5e7eb', // gray-200
        active: '#eff6ff', // blue-50 (Selection)
      },
      fontSize: {
        'xxs': '0.65rem',
      },
      boxShadow: {
        'window': '0 10px 40px -10px rgba(0, 0, 0, 0.2)', // Softer shadow for light mode
        'panel': '1px 0 0 0 #e5e7eb',
      }
    },
  },
  plugins: [],
}
