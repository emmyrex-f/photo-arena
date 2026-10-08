import { ChevronDown, ChevronUp, ImageIcon, Plus, Trash2 } from "lucide-react";
import { Button } from "../../admin/components/ui/button";
import { Input } from "../../admin/components/ui/input";
import { Textarea } from "../../admin/components/ui/textarea";
import { DEFAULT_SERVICE_PAGE_CARDS, type ServicePageCard } from "../../data/servicePageCards";

type CatalogService = { slug: string; name: string };

function textField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Keeps in-progress rows. The public page drops a row that is still incomplete. */
export function editorServicePageCards(raw: string): ServicePageCard[] {
  if (!raw.trim()) return DEFAULT_SERVICE_PAGE_CARDS.map((card) => ({ ...card }));
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_SERVICE_PAGE_CARDS.map((card) => ({ ...card }));
    return parsed.map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return {
        title: textField(row.title),
        description: textField(row.description),
        tag: textField(row.tag),
        image: textField(row.image),
        link: textField(row.link) || "contact",
      };
    });
  } catch {
    return DEFAULT_SERVICE_PAGE_CARDS.map((card) => ({ ...card }));
  }
}

export function ServicePageCardsEditor({
  raw,
  services,
  onChange,
  onPickImage,
}: {
  raw: string;
  services: CatalogService[];
  onChange: (json: string) => void;
  onPickImage: (index: number) => void;
}) {
  const cards = editorServicePageCards(raw);

  function commit(next: ServicePageCard[]) {
    onChange(JSON.stringify(next));
  }

  function update(index: number, patch: Partial<ServicePageCard>) {
    commit(cards.map((card, i) => (i === index ? { ...card, ...patch } : card)));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= cards.length) return;
    const next = cards.slice();
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    commit(next);
  }

  return (
    <div className="space-y-4">
      {cards.map((card, index) => {
        const known = card.link === "contact" || services.some((service) => service.slug === card.link);
        return (
          <div key={index} className="rounded-md border border-border p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="font-subtitle text-xs uppercase tracking-[0.14em] text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </p>
              <div className="flex items-center gap-1">
                <Button type="button" variant="outline" size="sm" onClick={() => move(index, -1)} disabled={index === 0}>
                  <ChevronUp className="h-4 w-4" />
                  <span className="sr-only">Move up</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => move(index, 1)}
                  disabled={index === cards.length - 1}
                >
                  <ChevronDown className="h-4 w-4" />
                  <span className="sr-only">Move down</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => commit(cards.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Remove card</span>
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
              <button
                type="button"
                onClick={() => onPickImage(index)}
                className="relative h-28 overflow-hidden rounded-md border border-border bg-muted"
              >
                {card.image ? (
                  <img src={card.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="m-auto h-6 w-6 text-muted-foreground" />
                )}
              </button>
              <div className="grid gap-3">
                <Input
                  aria-label="Card title"
                  value={card.title}
                  onChange={(event) => update(index, { title: event.target.value })}
                />
                <Textarea
                  aria-label="Card description"
                  value={card.description}
                  rows={3}
                  onChange={(event) => update(index, { description: event.target.value })}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    aria-label="Card tag"
                    value={card.tag}
                    onChange={(event) => update(index, { tag: event.target.value })}
                  />
                  <select
                    aria-label="Service this card opens"
                    value={card.link}
                    onChange={(event) => update(index, { link: event.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
                  >
                    <option value="contact">Contact page</option>
                    {!known ? <option value={card.link}>{card.link}</option> : null}
                    {services.map((service) => (
                      <option key={service.slug} value={service.slug}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          commit([
            ...cards,
            {
              title: "New service",
              description: "Describe this session.",
              tag: "Walk-In Available",
              image: "/media/services/portraits.jpg",
              link: services[0]?.slug ?? "contact",
            },
          ])
        }
      >
        <Plus className="h-4 w-4" />
        Add card
      </Button>
    </div>
  );
}
