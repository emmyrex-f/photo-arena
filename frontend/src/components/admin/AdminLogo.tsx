import { cn } from "../../lib/cn";

type Props = {
  className?: string;
  /** Force the white wordmark (dark/photo backgrounds), ignoring theme. */
  onDark?: boolean;
};

/** Transparent Photo Arena wordmark. Light surfaces use charcoal letters; dark surfaces use white. Gold shutter is unchanged. */
export function AdminLogo({ className, onDark = false }: Props) {
  if (onDark) {
    return <img src="/admin-logo.png" alt="Photo Arena" className={cn("h-auto w-auto", className)} />;
  }
  return (
    <>
      <img src="/admin-logo-on-light.png" alt="Photo Arena" className={cn("h-auto w-auto dark:hidden", className)} />
      <img src="/admin-logo.png" alt="Photo Arena" className={cn("hidden h-auto w-auto dark:block", className)} />
    </>
  );
}
