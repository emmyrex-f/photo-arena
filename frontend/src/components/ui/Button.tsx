import { Link } from "react-router-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

type Common = {
  children: ReactNode;
  variant?: Variant;
  className?: string;
};

type ButtonAsButton = Common &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    to?: undefined;
  };

type ButtonAsLink = Common & {
  to: string;
};

const styles: Record<Variant, string> = {
  primary:
    "bg-accent text-text-on-accent hover:bg-accent-hover border border-accent",
  secondary:
    "bg-transparent text-text border border-elevated hover:border-accent hover:text-accent",
  ghost: "bg-transparent text-text-secondary hover:text-accent border border-transparent",
};

function classNames(variant: Variant, className?: string) {
  return [
    "inline-flex items-center justify-center gap-2 min-h-11 rounded-xl px-6 py-3 text-sm font-button font-normal tracking-wide transition-colors duration-200",
    styles[variant],
    className ?? "",
  ].join(" ");
}

/** Absolute / scheme URLs must use <a>, not React Router <Link>. */
export function isExternalHref(href: string): boolean {
  const value = href.trim();
  if (!value) return false;
  if (value.startsWith("//")) return true;
  return /^(https?:|mailto:|tel:|sms:)/i.test(value);
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: ButtonAsButton | ButtonAsLink) {
  const classes = classNames(variant, className);

  if ("to" in props && props.to) {
    const href = props.to.trim();
    if (isExternalHref(href)) {
      const external = /^(https?:|\/\/)/i.test(href);
      return (
        <a
          href={href}
          className={classes}
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        >
          {children}
        </a>
      );
    }
    return (
      <Link to={href} className={classes}>
        {children}
      </Link>
    );
  }

  const buttonProps = props as ButtonAsButton;
  return (
    <button className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
