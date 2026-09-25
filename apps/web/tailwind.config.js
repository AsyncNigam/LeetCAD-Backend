/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        /* ── Canvas & Surface ─────────────────────── */
        canvas: "#F9F6F0",
        surface: {
          DEFAULT: "#FFFFFF",
          subtle: "#F3EFE6",
        },

        /* ── Borders (drafting grid feel) ─────────── */
        border: {
          DEFAULT: "#E4DDD3",
          strong: "#C8BEAF",
        },

        /* ── Text hierarchy ───────────────────────── */
        text: {
          primary: "#1A1D1A",
          muted: "#686E67",
          faint: "#9DA39C",
        },

        /* ── Brand: Forest Slate & Mint ───────────── */
        brand: {
          forest: "#143823",
          "forest-hover": "#0E2718",
          mint: "#E2F1E4",
          "mint-dark": "#255E38",
        },

        /* ── CAD Viewport ─────────────────────────── */
        "cad-viewport": "#121312",
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
  plugins: [],
};
