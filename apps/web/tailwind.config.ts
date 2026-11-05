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
        truticket: {
          dark: "#09090D",
          surface: "#12121A",
          elevated: "#1A1A25",
          primary: "#2563EB",
          success: "#34D399",
          warning: "#FBBF24",
          danger: "#FB7185",
        },
      },
    },
  },
  plugins: [],
};

export default config;