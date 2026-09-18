import type { ReactNode } from "react";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-eyebrow text-xs font-medium uppercase tracking-[0.22em] text-accent">{children}</p>
  );
}

export function Heading({
  as: Tag = "h2",
  children,
  className = "",
}: {
  as?: "h1" | "h2" | "h3";
  children: ReactNode;
  className?: string;
}) {
  const sizes = {
    h1: "font-display text-4xl leading-tight sm:text-5xl md:text-6xl",
    h2: "font-display text-3xl leading-tight sm:text-4xl",
    h3: "font-display text-2xl leading-snug",
  };

  return <Tag className={`${sizes[Tag]} text-text ${className}`}>{children}</Tag>;
}
