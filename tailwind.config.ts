import type { Config } from "tailwindcss";

// Colours are CSS variables (see globals.css) so the dark theme can swap
// them: brand colours stay fixed, surfaces and text follow the theme.
const token = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pine: "#2b3d33",
        "pine-dark": "#1c2921",
        moss: "#5c7a63",
        apricot: "#e2792b",
        "apricot-dark": "#c4631d",
        // theme-aware
        stone: token("stone"), // page background
        sand: token("sand"), // tinted panels
        surface: token("surface"), // cards, tables, modals
        ink: token("ink"), // body text
        muted: token("muted"), // secondary text
        line: token("line"), // borders
        heading: token("heading"), // titles (pine in light mode)
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "ui-sans-serif", "sans-serif"],
      },
      keyframes: {
        heartbeat: {
          "0%, 100%": { transform: "scale(1)" },
          "15%": { transform: "scale(1.25)" },
          "30%": { transform: "scale(1)" },
          "45%": { transform: "scale(1.18)" },
        },
      },
      animation: {
        heartbeat: "heartbeat 1.3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
