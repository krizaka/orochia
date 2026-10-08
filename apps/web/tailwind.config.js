const path = require("path");

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    path.join(__dirname, "app/**/*.{js,ts,jsx,tsx,mdx}"),
    path.join(__dirname, "components/**/*.{js,ts,jsx,tsx,mdx}"),
    path.join(__dirname, "lib/**/*.{js,ts,jsx,tsx,mdx}"),
    path.join(__dirname, "../../packages/**/*.{js,ts,jsx,tsx}"),
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: [
          "var(--font-outfit)",
          "Outfit",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
      },
      // The Krizaka easing for every `transition-*` utility (no `ease-*` class needed), and a calm default duration.
      transitionTimingFunction: { DEFAULT: "var(--kz-ease)", kz: "var(--kz-ease)" },
      transitionDuration: { DEFAULT: "200ms" },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-fade": "glowFade 3s ease-in-out infinite alternate",
      },
      keyframes: {
        glowFade: {
          "0%": { opacity: "0.3", transform: "scale(0.98)" },
          "100%": { opacity: "0.7", transform: "scale(1.02)" },
        },
      },
    },
  },
  plugins: [
    function ({ addVariant }) {
      // `light:` applies in the light theme — except inside a `.theme-dark` island (media editors, players), which
      // stays dark in both themes. :where() keeps the specificity unchanged.
      const outsideDarkIsland = ":where(:not(.theme-dark, .theme-dark *))";
      addVariant("light", [`html.light &${outsideDarkIsland}`, `.light &${outsideDarkIsland}`, `:root:not(.dark) &${outsideDarkIsland}`]);
    },
  ],
};
