import { cn } from "../../lib/cn";
import { Container } from "../ui/Container";
import { Eyebrow, Heading } from "../ui/Heading";

export function PageHeader({
  eyebrow,
  title,
  description,
  bordered = true,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  bordered?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-surface/40 py-header-y",
        bordered && "border-b border-elevated",
        className,
      )}
    >
      <Container className="max-w-3xl">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <Heading as="h1">{title}</Heading>
        {description ? (
          <p className="mt-stack max-w-xl text-base leading-relaxed text-text-secondary">{description}</p>
        ) : null}
      </Container>
    </div>
  );
}
