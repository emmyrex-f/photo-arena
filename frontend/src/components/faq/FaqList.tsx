import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { fetchFaqs, type Faq } from "../../lib/publicApi";
import { usePublicData } from "../../lib/usePublicData";

export function FaqList({ items }: { items?: Faq[] }) {
  const { data, loading } = usePublicData(() => fetchFaqs(), []);
  const faqs = items ?? data ?? [];
  const baseId = useId();
  const [open, setOpen] = useState<number | null>(0);

  if (!items && loading && faqs.length === 0) {
    return <p className="text-text-secondary">Loading questions…</p>;
  }

  if (faqs.length === 0) {
    return <p className="text-text-secondary">No questions published yet.</p>;
  }

  return (
    <div className="divide-y divide-elevated">
      {faqs.map((item, index) => {
        const expanded = open === index;
        const buttonId = `${baseId}-q-${index}`;
        const panelId = `${baseId}-a-${index}`;
        return (
          <div key={item.id ?? item.question}>
            <h2>
              <button
                id={buttonId}
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                className="flex min-h-14 w-full items-center justify-between gap-stack-sm py-stack text-left text-base text-text"
                onClick={() => setOpen(expanded ? null : index)}
              >
                {item.question}
                <Plus
                  className={`h-5 w-5 shrink-0 text-accent transition ${expanded ? "rotate-45" : ""}`}
                  aria-hidden="true"
                />
              </button>
            </h2>
            <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!expanded}>
              <p className="pb-grid leading-relaxed text-text-secondary">{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
