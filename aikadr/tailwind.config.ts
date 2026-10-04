import type { Config } from "tailwindcss";

export default {
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0b10",
        card: "#16161f",
        line: "#26263a",
        brand: { DEFAULT: "#7c5cff", dark: "#5b3df5", light: "#a28bff" },
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
