/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#F8F9FA",
        surface: "#FFFFFF",
        border: {
          subtle: "#E5E7EB",
          DEFAULT: "#E5E7EB",
          strong: "#D1D5DB",
        },
        ink: {
          primary: "#111827",
          secondary: "#6B7280",
          tertiary: "#9CA3AF",
        },
        brand: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          DEFAULT: "#2563EB",
        },
        status: {
          success: "#059669",
          warning: "#D97706",
          danger: "#DC2626",
          info: "#2563EB",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "IBM Plex Mono", "Menlo", "Courier New", "monospace"],
      },
    },
  },
  plugins: [],
}
