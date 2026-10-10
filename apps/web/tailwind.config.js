/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        /* ── Canvas & Surface ─────────────────────── */
        canvas: "#F4EFE6", // Warm beige background
        surface: {
          DEFAULT: "#FFFFFF", // Pure white for distinct boxes
          subtle: "#FAFAFA",
        },

        /* ── Borders ─────────────────────────── */
        border: {
          DEFAULT: "#E5DCD0",
          strong: "#D4C5B0",
        },

        /* ── Text hierarchy ───────────────────────── */
        text: {
          primary: "#1E293B", // Slate-800 for stark contrast
          muted: "#475569", // Slate-600
          faint: "#94A3B8", // Slate-400
        },

        /* ── Brand: Forest Slate & Mint ───────────── */
        brand: {
          forest: "#115E59", // Deep teal/forest
          "forest-hover": "#134E4A",
          mint: "#CCFBF1", // Teal-50
          "mint-dark": "#0F766E", // Teal-600
        },

        /* ── CAD Viewport ─────────────────────────── */
        "cad-viewport": "#F8FAFC",
      },

      fontFamily: {
        sans: [
          '"Inter"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          '"JetBrains Mono"',
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },

      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },

      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
