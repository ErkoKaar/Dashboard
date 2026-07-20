import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background-rgb) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--surface-rgb) / <alpha-value>)",
          hover: "rgb(var(--surface-hover-rgb) / <alpha-value>)",
        },
        border: "rgb(var(--border-rgb) / <alpha-value>)",
        foreground: "rgb(var(--foreground-rgb) / <alpha-value>)",
        muted: "rgb(var(--muted-rgb) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          bright: "rgb(var(--accent-bright-rgb) / <alpha-value>)",
        },
        positive: {
          DEFAULT: "rgb(var(--positive-rgb) / <alpha-value>)",
          warm: "rgb(var(--positive-warm-rgb) / <alpha-value>)",
        },
        warning: "rgb(var(--warning-rgb) / <alpha-value>)",
        destructive: "rgb(var(--destructive-rgb) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      gridTemplateColumns: {
        dashboard: "repeat(12, minmax(0, 1fr))",
      },
    },
  },
  plugins: [],
};
export default config;
