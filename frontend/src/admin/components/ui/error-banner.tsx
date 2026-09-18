import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "../../../lib/cn";
import { Button } from "./button";

type ErrorBannerProps = {
  message: string | null | undefined;
  onRetry?: () => void;
  retrying?: boolean;
  title?: string;
  className?: string;
};

function ErrorBanner({ message, onRetry, retrying, title = "Something went wrong", className }: ErrorBannerProps) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-admin-gap rounded-lg border border-destructive/30 bg-destructive/10 px-admin-stack-sm py-admin-gap text-sm sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <p className="text-muted-foreground">{message}</p>
        </div>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} loading={retrying} className="sm:shrink-0">
          {retrying ? null : <RefreshCw />}
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export { ErrorBanner };
