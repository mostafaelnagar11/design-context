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
        bg: "#EDEBE4",
        shell: "#F2F0EB",
        panel: "#E8E5DE",
        sidebar: "#E2DFD8",
        ink: "#1a1a1a",
        soft: "#666",
        mute: "#bbb",
        "ink-mute": "#999",
      },
      fontFamily: {
        mono: ["'Courier New'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        lofi: "5px 5px 0 #C8C4B8",
        lofiHard: "5px 5px 0 #1a1a1a",
      },
    },
  },
  plugins: [],
};
export default config;
