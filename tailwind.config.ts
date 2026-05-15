import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#080b12",
        panel: "#101522",
        muted: "#9aa6bc",
        line: "#293246",
        cyan: "#4da3ff"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(77,163,255,.13), 0 18px 60px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.06)",
        neon: "0 0 18px rgba(77,163,255,.18), 0 0 38px rgba(61,220,132,.06)"
      }
    }
  },
  plugins: []
};

export default config;
