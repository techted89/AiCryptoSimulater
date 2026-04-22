import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "inverse-on-surface": "#2d3137",
        "tertiary-fixed-dim": "#e9b3ff",
        "secondary-container": "#05e777",
        "inverse-primary": "#006970",
        "on-secondary-container": "#00622e",
        "error": "#ffb4ab",
        "surface-container-high": "#262a31",
        "on-primary-fixed": "#002022",
        "on-primary-fixed-variant": "#004f54",
        "tertiary": "#fff2fe",
        "primary-fixed": "#7df4ff",
        "on-tertiary": "#510074",
        "surface-container-low": "#181c22",
        "surface-container-highest": "#31353c",
        "primary-fixed-dim": "#00dbe9",
        "on-tertiary-container": "#9027c4",
        "secondary": "#7dffa2",
        "on-tertiary-fixed-variant": "#7200a3",
        "secondary-fixed": "#62ff96",
        "outline": "#849495",
        "error-container": "#93000a",
        "on-error-container": "#ffdad6",
        "inverse-surface": "#dfe2eb",
        "surface-dim": "#10141a",
        "on-secondary-fixed": "#00210b",
        "on-secondary": "#003918",
        "tertiary-fixed": "#f6d9ff",
        "outline-variant": "#3b494b",
        "surface-bright": "#353940",
        "secondary-fixed-dim": "#00e475",
        "on-surface": "#dfe2eb",
        "on-background": "#dfe2eb",
        "background": "#10141a",
        "on-secondary-fixed-variant": "#005226",
        "surface-container-lowest": "#0a0e14",
        "on-primary": "#00363a",
        "surface-tint": "#00dbe9",
        "primary": "#dbfcff",
        "on-primary-container": "#006970",
        "surface-container": "#1c2026",
        "on-tertiary-fixed": "#310048",
        "surface-variant": "#31353c",
        "primary-container": "#00f0ff",
        "surface": "#10141a",
        "on-surface-variant": "#b9cacb",
        "on-error": "#690005",
        "tertiary-container": "#f2cdff"
      },
      borderRadius: {
        "DEFAULT": "0.125rem",
        "lg": "0.25rem",
        "xl": "0.5rem",
        "full": "0.75rem"
      },
      fontFamily: {
        "headline": ["var(--font-space-grotesk)"],
        "display": ["var(--font-space-grotesk)"],
        "body": ["var(--font-inter)"],
        "label": ["var(--font-inter)"]
      }
    },
  },
  plugins: [],
};
export default config;