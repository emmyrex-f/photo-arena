import { useId, type ReactNode } from "react";
import { cn } from "../../../lib/cn";
import { Label } from "./label";

type FormFieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  /** Render prop receives the generated id + aria attributes for the control. */
  children: (control: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
  /** Layout the label and control side-by-side (switches, checkboxes). */
  inline?: boolean;
};

function FormField({ label, hint, error, required, className, children, inline }: FormFieldProps) {
  const id = useId();
  const describedBy = hint || error ? `${id}-desc` : undefined;
  const control = children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy });

  if (inline) {
    return (
      <div className={cn("flex items-start justify-between gap-admin-stack-sm py-admin-control", className)}>
        <div className="min-w-0">
          <Label htmlFor={id}>{label}</Label>
          {hint ? (
            <p id={describedBy} className="mt-1 text-xs text-muted-foreground">
              {hint}
            </p>
          ) : null}
        </div>
        <div className="shrink-0">{control}</div>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-admin-control", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {control}
      {error ? (
        <p id={describedBy} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={describedBy} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export { FormField };
