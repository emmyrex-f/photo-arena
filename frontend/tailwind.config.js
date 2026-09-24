/** @type {import('tailwindcss').Config} */
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* ---- Public site semantic tokens (see src/index.css) ---- */
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        elevated: "var(--color-elevated)",
        dark: "var(--color-dark)",
        text: {
          DEFAULT: "var(--color-text)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
          inverse: "var(--color-text-inverse)",
          "inverse-muted": "var(--color-text-inverse-muted)",
          "on-accent": "var(--color-on-accent)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          /* shadcn compatibility: `accent-foreground` used by some generated components */
          foreground: "var(--color-on-accent)",
        },
        champagne: "var(--color-champagne)",
        sage: "var(--color-sage)",
        brown: "var(--color-brown)",
        olive: "var(--color-olive)",
        ink: "var(--color-ink)",
        "dark-deep": "var(--color-dark-deep)",
        border: {
          DEFAULT: "var(--color-border)",
          subtle: "var(--color-border-subtle)",
          strong: "var(--color-border-strong)",
        },
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        error: "var(--color-error)",

        /* ---- Admin / shadcn tokens (see src/admin/admin.css, scoped to .admin-root) ---- */
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
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
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          border: "hsl(var(--sidebar-border))",
          active: "hsl(var(--sidebar-active))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        display: ["EB Garamond", "Georgia", "serif"],
        hero: ["EB Garamond", "Georgia", "serif"],
        subtitle: ["Overpass Mono", "ui-monospace", "monospace"],
        body: ["Libre Baskerville", "Georgia", "serif"],
        button: ["Overpass Mono", "ui-monospace", "monospace"],
      },
      spacing: {
        gutter: "var(--pa-gutter)",
        "section-y": "var(--pa-section-y)",
        "header-y": "var(--pa-header-y)",
        "footer-y": "var(--pa-footer-y)",
        eyebrow: "var(--pa-eyebrow)",
        label: "var(--pa-label)",
        "stack-sm": "var(--pa-stack-sm)",
        stack: "var(--pa-stack)",
        "stack-lg": "var(--pa-stack-lg)",
        "stack-xl": "var(--pa-stack-xl)",
        "stack-2xl": "var(--pa-stack-2xl)",
        control: "var(--pa-control)",
        form: "var(--pa-form)",
        "card-sm": "var(--pa-card-sm)",
        card: "var(--pa-card)",
        "card-lg": "var(--pa-card-lg)",
        "grid-tight": "var(--pa-grid-tight)",
        grid: "var(--pa-grid)",
        "grid-lg": "var(--pa-grid-lg)",
        "admin-gutter": "var(--admin-gutter)",
        "admin-page": "var(--admin-page-y)",
        "admin-header": "var(--admin-header-h)",
        "admin-stack": "var(--admin-stack)",
        "admin-stack-sm": "var(--admin-stack-sm)",
        "admin-card": "var(--admin-card)",
        "admin-card-sm": "var(--admin-card-sm)",
        "admin-control": "var(--admin-control)",
        "admin-gap": "var(--admin-gap)",
        "admin-nav": "var(--admin-nav-y)",
        "admin-sidebar": "var(--admin-sidebar-x)",
      },
      maxWidth: {
        site: "72rem",
        wide: "84rem",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        nav: "var(--shadow-nav)",
      },
      letterSpacing: {
        eyebrow: "0.28em",
      },
      screens: {
        "3xl": "1600px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [animate],
};
