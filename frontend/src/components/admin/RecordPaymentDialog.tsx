import { FormEvent, useEffect, useState } from "react";
import { Button } from "../../admin/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../admin/components/ui/dialog";
import { Input } from "../../admin/components/ui/input";
import { Label } from "../../admin/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../admin/components/ui/select";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import { formatNairaFromKobo } from "../../admin/lib/format";
import type { BookingRecord } from "../../admin/lib/types";
import { errorMessage } from "../../lib/api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingRecord | null;
  onSuccess: (updated: BookingRecord) => void;
};

export function RecordPaymentDialog({ open, onOpenChange, booking, onSuccess }: Props) {
  const api = useAdminApi();
  const [channel, setChannel] = useState<"CASH" | "POS" | "TRANSFER">("POS");
  const [amountNaira, setAmountNaira] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  const dueKobo = booking?.amountKobo ?? booking?.package.priceKobo ?? 0;
  const paidKobo =
    booking?.payments
      .filter((p) => p.status === "SUCCESS")
      .reduce((sum, p) => sum + p.amountKobo - (p.refundedAmountKobo ?? 0), 0) ?? 0;
  const outstandingKobo = Math.max(0, dueKobo - paidKobo);

  useEffect(() => {
    if (open && booking) {
      setAmountNaira(String(Math.round(outstandingKobo / 100)));
      setChannel("POS");
      setReference("");
      setNote("");
    }
  }, [open, booking, outstandingKobo]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!booking) return;

    const parsedNaira = parseFloat(amountNaira);
    if (!Number.isFinite(parsedNaira) || parsedNaira <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    const payKobo = Math.round(parsedNaira * 100);
    if (payKobo > outstandingKobo) {
      toast.error(
        `Amount exceeds outstanding balance of ${formatNairaFromKobo(outstandingKobo)}`,
      );
      return;
    }

    setPending(true);
    try {
      const updated = await api.bookings.recordPayment(booking.id, {
        amountKobo: payKobo,
        channel,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      });

      toast.success("Payment recorded successfully");
      onSuccess(updated);
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, "Could not record payment"));
    } finally {
      setPending(false);
    }
  }

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record studio payment</DialogTitle>
          <DialogDescription>
            Record an offline payment (Cash, POS, or Bank Transfer) for {booking.customer.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Package</span>
            <span className="font-medium text-foreground">{booking.package.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total due</span>
            <span className="font-medium text-foreground tabular-nums">
              {formatNairaFromKobo(dueKobo)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Already paid</span>
            <span className="font-medium text-foreground tabular-nums">
              {formatNairaFromKobo(paidKobo)}
            </span>
          </div>
          <div className="flex justify-between border-t border-border pt-1 font-semibold text-primary">
            <span>Outstanding balance</span>
            <span className="tabular-nums">{formatNairaFromKobo(outstandingKobo)}</span>
          </div>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="payment-channel">Payment method</Label>
              <Select
                value={channel}
                onValueChange={(val) => setChannel(val as "CASH" | "POS" | "TRANSFER")}
              >
                <SelectTrigger id="payment-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POS">POS Terminal</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="TRANSFER">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-amount">Amount (₦)</Label>
              <Input
                id="payment-amount"
                type="number"
                min="1"
                step="any"
                value={amountNaira}
                onChange={(e) => setAmountNaira(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-reference">
              Reference / Transaction ID <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="payment-reference"
              type="text"
              placeholder={channel === "POS" ? "e.g. POS RRN / Terminal code" : "e.g. Bank transfer session ID"}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-note">
              Internal note <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="payment-note"
              type="text"
              placeholder="e.g. Paid balance at front desk"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Confirm Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
