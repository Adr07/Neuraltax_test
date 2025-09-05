/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html","./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    fontFamily: { sans: ["Inter","system-ui","sans-serif"] },
    extend: {
      colors: {
        primary: {
          900: "#03041C",
          800: "#1C2C3C",
          700: "#273746",
          600: "#334250",
          500: "#1F2F3E"
        },
        brand: {
          blue: "#243F5E",
          green: "#688071"
        },
        surface: {
          DEFAULT: "#F4F7F6",
          100: "#F7FAF9",
          200: "#E9EFED",
          300: "#DDE5E2"
        }
      },
      boxShadow: {
        card: "0 10px 20px rgba(0,0,0,0.05)"
      },
      borderRadius: {
        xl2: "1rem"
      }
    }
  },
  plugins: []
}
