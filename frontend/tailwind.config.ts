import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0A0F1E",
        panel: "rgba(15, 23, 42, 0.72)",
        line: "rgba(148, 163, 184, 0.18)",
        accent: "#3B82F6"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(59,130,246,0.38), 0 28px 80px rgba(59,130,246,0.28)",
        card: "0 24px 70px rgba(0,0,0,0.24)"
      },
      animation: {
        "fade-in": "fade-in 520ms ease-out both",
        "pulse-soft": "pulse-soft 1.5s ease-in-out infinite"
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.52" },
          "50%": { opacity: "1" }
        }
      }
    }
  },
  plugins: []
} satisfies Config;
