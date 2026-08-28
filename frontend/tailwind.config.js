/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        felt: {
          900: "#07130d",
          800: "#0d2216",
          700: "#12331f"
        }
      },
      boxShadow: {
        glow: "0 0 24px rgba(34, 197, 94, 0.18)"
      }
    }
  },
  plugins: []
};
