const SIZES = { sm: 36, md: 56, lg: 80 } as const;

type CameraSpinnerProps = {
  /** Accessible name. Shown visually when `caption` is omitted. */
  label?: string;
  caption?: string;
  size?: keyof typeof SIZES;
  className?: string;
};

/**
 * Site loader: the gold shutter cropped for the favicon, spinning like an aperture.
 * Uses `/android-chrome-192x192.png` — same mark as the browser icon.
 */
export function CameraSpinner({
  label = "Loading",
  caption,
  size = "md",
  className,
}: CameraSpinnerProps) {
  const px = SIZES[size];
  const text = caption ?? label;
  return (
    <div
      className={["flex flex-col items-center justify-center gap-3", className ?? ""].join(" ")}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <img
        src="/android-chrome-192x192.png"
        alt=""
        width={px}
        height={px}
        className="pa-shutter-spin"
        decoding="async"
      />
      {text ? <p className="text-sm text-text-secondary">{text}</p> : <span className="sr-only">{label}</span>}
    </div>
  );
}
