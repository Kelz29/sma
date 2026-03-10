/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"Helvetica Neue"',
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        brand: {
          primary: "var(--brand-primary)",
          "primary-hover": "var(--brand-primary-hover)",
          secondary: "var(--brand-secondary)",
        },
        page: "var(--bg-page)",
        card: "var(--bg-card)",
        sidebar: "var(--bg-sidebar)",
      },
      borderRadius: {
        "apple": "10px",
        "apple-lg": "12px",
      },
      boxShadow: {
        "apple": "0 1px 3px rgba(0,0,0,0.06)",
        "apple-md": "0 4px 12px rgba(0,0,0,0.06)",
        "apple-lg": "0 8px 24px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};

