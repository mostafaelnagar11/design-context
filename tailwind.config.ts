import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark surfaces
        bg:       "#080808",
        surface:  "#111111",
        "surface-2": "#181818",
        "surface-3": "#222222",
        // Borders
        border:   "#2a2a2a",
        "border-2": "#383838",
        // Text
        primary:  "#F0F0F0",
        secondary:"#888888",
        muted:    "#4a4a4a",
        // Accent
        accent:   "#6366F1",
        "accent-hover": "#4F46E5",
        // Status
        green:    "#22C55E",
        amber:    "#F59E0B",
        red:      "#EF4444",
        // Legacy aliases (so old classes don't hard-crash)
        ink:      "#F0F0F0",
        soft:     "#888888",
        mute:     "#4a4a4a",
        "ink-mute": "#666666",
        shell:    "#111111",
        panel:    "#181818",
        sidebar:  "#111111",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["'Geist Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.6)",
        modal: "0 25px 50px rgba(0,0,0,0.8)",
        lofi: "none",
        lofiHard: "none",
      },
      borderRadius: {
        DEFAULT: "8px",
      },
    },
  },
  plugins: [],
};
export default config;
