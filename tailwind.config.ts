import type { Config } from "tailwindcss";

// Culmen brand. The four colour families are fixed; surfaces and text are
// CSS variables (see globals.css) so the dark theme can swap them.
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
        // main: actions, text, dark grounds
        spruce: { 900: "#12332D", 700: "#14443B", 500: "#1E5B4F", 300: "#4FA08D", 100: "#DCEBE6" },
        // main: warmth, highlights, focus
        terracotta: { 700: "#8F2F10", 500: "#C9491F", 300: "#EE7F58", 100: "#F9DFD2" },
        // secondary, small touches only (never white text on it)
        apricot: { 700: "#6B4800", 500: "#F2B134", 300: "#F7CE7A", 100: "#FCEBC4" },
        card: "#FFFDF8",
        // theme-aware
        stone: token("stone"), // page background (Sand 50)
        sand: token("sand"), // tinted panels (Sand 100)
        surface: token("surface"), // cards, tables, modals
        ink: token("ink"), // body text (Spruce 900)
        muted: token("muted"), // secondary text (Moss)
        line: token("line"), // borders (Sand 200)
        heading: token("heading"), // titles
      },
      fontFamily: {
        // Outfit for Latin, Noto Sans Armenian for Armenian; headings use the
        // same family, heavier.
        sans: ["var(--font-outfit)", "var(--font-noto-armenian)", "system-ui", "sans-serif"],
        serif: ["var(--font-outfit)", "var(--font-noto-armenian)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1.5rem", // cards: 24px
      },
      keyframes: {
        // Rhythm of the classic "made with love" heart; scales evenly.
        heartbeat: {
          "0%": { transform: "scale(0.8)" },
          "5%": { transform: "scale(0.9)" },
          "10%": { transform: "scale(0.8)" },
          "15%": { transform: "scale(1)" },
          "50%": { transform: "scale(0.8)" },
          "100%": { transform: "scale(0.8)" },
        },
      },
      animation: {
        heartbeat: "heartbeat 1.5s infinite",
      },
    },
  },
  plugins: [],
};
export default config;
