/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#080b12",
          surface: "#0e1626",
          card: "#121c30",
          blue: "#0066ff",
          "blue-hover": "#0052cc",
          emerald: "#00e599",
          "emerald-dark": "#059669",
        },
      },
      boxShadow: {
        "blue-glow": "0 8px 24px -4px rgba(0, 102, 255, 0.35)",
        "emerald-glow": "0 8px 24px -4px rgba(0, 229, 153, 0.35)",
      },
    },
  },
  plugins: [],
};
