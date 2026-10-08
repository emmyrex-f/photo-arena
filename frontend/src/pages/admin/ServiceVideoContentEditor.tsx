import { Plus, Trash2 } from "lucide-react";
import { Button } from "../../admin/components/ui/button";
import { formatDuration } from "../../lib/datetime";
import { Input } from "../../admin/components/ui/input";
import { Textarea } from "../../admin/components/ui/textarea";
import {
  DEFAULT_SERVICE_VIDEO_CONTENT,
  type ServiceVideoContent,
} from "../../data/serviceVideoContent";

function textField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Keeps in-progress rows. The public page falls back when the saved JSON is invalid. */
function editorServiceVideoContent(raw: string): ServiceVideoContent {
  if (!raw.trim()) return structuredClone(DEFAULT_SERVICE_VIDEO_CONTENT);
  try {
    const parsed: unknown = JSON.parse(raw);
    const row = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    const paragraphs = Array.isArray(row.paragraphs) ? row.paragraphs.map(textField) : [""];
    const notes = Array.isArray(row.notes) ? row.notes.map(textField) : [""];
    return {
      eyebrow: textField(row.eyebrow),
      title: textField(row.title),
      paragraphs: paragraphs.length ? paragraphs : [""],
      notes: notes.length ? notes : [""],
    };
  } catch {
    return structuredClone(DEFAULT_SERVICE_VIDEO_CONTENT);
  }
}

export type VideoPackagePrice = {
  id: string;
  name: string;
  includes: string;
  durationMinutes: number;
  priceKobo: number;
};

export function ServiceVideoContentEditor({
  raw,
  onChange,
  packages = [],
  prices = {},
  onPriceChange,
}: {
  raw: string;
  onChange: (json: string) => void;
  packages?: VideoPackagePrice[];
  prices?: Record<string, string>;
  onPriceChange?: (packageId: string, naira: string) => void;
}) {
  const content = editorServiceVideoContent(raw);

  function commit(next: ServiceVideoContent) {
    onChange(JSON.stringify(next));
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Eyebrow</span>
          <Input value={content.eyebrow} onChange={(event) => commit({ ...content, eyebrow: event.target.value })} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Heading</span>
          <Input value={content.title} onChange={(event) => commit({ ...content, title: event.target.value })} />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Intro</p>
        {content.paragraphs.map((paragraph, index) => (
          <div key={index} className="flex gap-2">
            <Textarea
              value={paragraph}
              rows={2}
              onChange={(event) => {
                const paragraphs = content.paragraphs.slice();
                paragraphs[index] = event.target.value;
                commit({ ...content, paragraphs });
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={content.paragraphs.length === 1}
              onClick={() => commit({ ...content, paragraphs: content.paragraphs.filter((_, i) => i !== index) })}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Remove paragraph</span>
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => commit({ ...content, paragraphs: [...content.paragraphs, ""] })}
        >
          <Plus className="h-4 w-4" />
          Add paragraph
        </Button>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Studio price for each catalogue package. The card uses that package’s name, duration, and includes.
        </p>
        {packages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No video packages in the catalogue.</p>
        ) : (
          packages.map((pkg) => (
            <div key={pkg.id} className="flex flex-wrap items-end gap-3 rounded-md border border-border p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{pkg.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDuration(pkg.durationMinutes)}
                  {pkg.includes ? ` · ${pkg.includes}` : ""}
                </p>
              </div>
              <label className="w-36 space-y-1 text-sm">
                <span className="text-muted-foreground">Studio price (₦)</span>
                <Input
                  inputMode="decimal"
                  value={prices[pkg.id] ?? ""}
                  onChange={(event) => onPriceChange?.(pkg.id, event.target.value)}
                />
              </label>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Footer notes</p>
        {content.notes.map((note, index) => (
          <div key={index} className="flex gap-2">
            <Input
              value={note}
              onChange={(event) => {
                const notes = content.notes.slice();
                notes[index] = event.target.value;
                commit({ ...content, notes });
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => commit({ ...content, notes: content.notes.filter((_, i) => i !== index) })}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Remove note</span>
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => commit({ ...content, notes: [...content.notes, ""] })}>
          <Plus className="h-4 w-4" />
          Add note
        </Button>
      </div>
    </div>
  );
}
