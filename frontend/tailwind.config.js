/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        felt: {
          900: "#07130d",
          800: "#0d2216",
          700: "#12331f"
        },
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          500: '#10b981',
          600: '#059669',
          700: '#047857'
        }
      },
      boxShadow: {
        glow: "0 0 24px rgba(34, 197, 94, 0.18)"
      }
    }
  },
  plugins: []
};

