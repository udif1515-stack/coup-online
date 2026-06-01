import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        felt: "#12362f",
        ink: "#101828",
        brass: "#d6a94a",
        ember: "#d94f38",
        mist: "#e8f2ef"
      },
      boxShadow: {
        table: "0 24px 80px rgba(7, 18, 15, 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
