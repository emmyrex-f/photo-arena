import type { ReactNode } from "react";

export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto w-full min-w-0 max-w-site px-gutter ${className}`}>{children}</div>;
}
