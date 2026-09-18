import * as React from "react";
import { cn } from "../../../lib/cn";
import { Input } from "./input";

type MoneyInputProps = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  /** Value in kobo. */
  valueKobo: number | null;
  onChangeKobo: (kobo: number | null) => void;
};

/** Naira input that stores kobo. Shows ₦ prefix; accepts digits and commas. */
function MoneyInput({ valueKobo, onChangeKobo, className, ...props }: MoneyInputProps) {
  const [text, setText] = React.useState(() => (valueKobo === null ? "" : formatNaira(valueKobo)));
  const lastKobo = React.useRef(valueKobo);

  React.useEffect(() => {
    if (valueKobo !== lastKobo.current) {
      lastKobo.current = valueKobo;
      setText(valueKobo === null ? "" : formatNaira(valueKobo));
    }
  }, [valueKobo]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^\d]/g, "");
    if (!raw) {
      setText("");
      lastKobo.current = null;
      onChangeKobo(null);
      return;
    }
    const naira = Number(raw);
    const kobo = naira * 100;
    setText(new Intl.NumberFormat("en-NG").format(naira));
    lastKobo.current = kobo;
    onChangeKobo(kobo);
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₦</span>
      <Input
        inputMode="numeric"
        value={text}
        onChange={handleChange}
        className={cn("pl-7 tabular-nums", className)}
        {...props}
      />
    </div>
  );
}

function formatNaira(kobo: number) {
  return new Intl.NumberFormat("en-NG").format(Math.round(kobo / 100));
}

export { MoneyInput };
