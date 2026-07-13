/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0f",
        card: "rgba(22, 22, 38, 0.7)",
        primary: "#6366f1",
        accent: "#00ffcc",
        danger: "#ef4444",
        success: "#10b981",
        warning: "#f59e0b",
      },
      fontFamily: {
        sans: ["var(--font-outfit)", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
}
