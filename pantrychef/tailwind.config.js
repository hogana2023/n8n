/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}", "./content/**/*.{md,mdx}"],
  presets: [require("@relume_io/relume-tailwind")],
  theme: {
    extend: {
      // The Relume preset REPLACES theme.gradientColorStops, which breaks
      // from-*/via-*/to-* for our own colors. Re-point it at the palette.
      gradientColorStops: ({ theme }) => theme("colors"),

      fontFamily: {
        // SF Pro when the visitor is on Apple hardware, a close metric match
        // everywhere else. No webfont request, so the first paint has no FOUT.
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Inter",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["SF Mono", "ui-monospace", "Menlo", "monospace"],
      },

      // Apple's type ramp is larger and tracks tighter than Relume's default.
      // The published v3 preset omits these tokens entirely, so every heading
      // would otherwise collapse to the 16px base.
      fontSize: {
        display: ["5.5rem", { lineHeight: "1.05", letterSpacing: "-0.025em", fontWeight: "600" }],
        h1: ["3.75rem", { lineHeight: "1.07", letterSpacing: "-0.022em", fontWeight: "600" }],
        h2: ["3rem", { lineHeight: "1.08", letterSpacing: "-0.02em", fontWeight: "600" }],
        h3: ["2.25rem", { lineHeight: "1.11", letterSpacing: "-0.018em", fontWeight: "600" }],
        h4: ["1.75rem", { lineHeight: "1.15", letterSpacing: "-0.015em", fontWeight: "600" }],
        h5: ["1.375rem", { lineHeight: "1.25", letterSpacing: "-0.012em", fontWeight: "600" }],
        h6: ["1.125rem", { lineHeight: "1.35", letterSpacing: "-0.01em", fontWeight: "600" }],
        large: ["1.3125rem", { lineHeight: "1.45", letterSpacing: "-0.01em" }],
        medium: ["1.1875rem", { lineHeight: "1.5", letterSpacing: "-0.008em" }],
        regular: ["1.0625rem", { lineHeight: "1.55", letterSpacing: "-0.005em" }],
        small: ["0.9375rem", { lineHeight: "1.5" }],
        tiny: ["0.8125rem", { lineHeight: "1.45" }],
      },

      colors: {
        // Apple's actual system greys, not generic Tailwind slate.
        ink: {
          DEFAULT: "#1d1d1f",
          soft: "#6e6e73",
          faint: "#86868b",
        },
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f5f5f7",
          sunken: "#fafafa",
          neutral: "#e8e8ed",
        },
        accent: {
          DEFAULT: "#0071e3",
          hover: "#0077ed",
          quiet: "#e8f1fd",
        },
        // PantryChef's own colour: a warm herb green for produce/fresh cues.
        herb: {
          DEFAULT: "#1d7a4c",
          soft: "#eaf5ef",
        },
        hairline: "#d2d2d7",
        // Relume sections read from these; default them to the light scheme.
        scheme: {
          background: "#ffffff",
          foreground: "#f5f5f7",
          text: "#1d1d1f",
          border: "#d2d2d7",
          "btn-text": "#ffffff",
        },
      },

      // Relume ships sharp 0rem corners. Apple never does.
      borderRadius: {
        button: "9999px",
        card: "1.25rem",
        image: "1.125rem",
        form: "0.75rem",
        badge: "9999px",
        checkbox: "0.375rem",
        carousel: "1.25rem",
        dropdown: "1rem",
      },

      boxShadow: {
        // Soft, wide, low-opacity — Apple's cards read as lifted paper, never
        // as a drop-shadowed box.
        card: "0 4px 24px rgba(0,0,0,0.06)",
        lifted: "0 12px 40px rgba(0,0,0,0.10)",
        nav: "0 1px 0 rgba(0,0,0,0.06)",
      },

      maxWidth: {
        prose: "42rem",
        shell: "80rem",
      },

      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.28, 0.11, 0.32, 1) both",
      },

      transitionTimingFunction: {
        // Apple's standard easing curve.
        apple: "cubic-bezier(0.28, 0.11, 0.32, 1)",
      },
    },
  },
  plugins: [],
};
