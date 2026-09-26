import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pine: "#2b3d33",
        apricot: "#e2792b",
        stone: "#f6f4ee",
      },
    },
  },
  plugins: [],
};
export default config;
