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
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import { formatNairaFromKobo } from "../../admin/lib/format";
import type { Payment } from "../../admin/lib/types";
import { errorMessage } from "../../lib/api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment | null;
  onSuccess: (updated: Payment) => void;
};

export function RefundPaymentDialog({ open, onOpenChange, payment, onSuccess }: Props) {
  const api = useAdminApi();
  const [amountNaira, setAmountNaira] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  const refundableKobo = Math.max(
    0,
    (payment?.amountKobo ?? 0) - (payment?.refundedAmountKobo ?? 0),
  );

  useEffect(() => {
    if (open && payment) {
      setAmountNaira(String(Math.round(refundableKobo / 100)));
      setReason("");
    }
  }, [open, payment, refundableKobo]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!payment) return;

    const parsedNaira = parseFloat(amountNaira);
    if (!Number.isFinite(parsedNaira) || parsedNaira <= 0) {
      toast.error("Please enter a valid refund amount");
      return;
    }

    const refundKobo = Math.round(parsedNaira * 100);
    if (refundKobo > refundableKobo) {
      toast.error(
        `Refund exceeds refundable balance of ${formatNairaFromKobo(refundableKobo)}`,
      );
      return;
    }

    if (reason.trim().length < 3) {
      toast.error("Please provide a reason for the refund (minimum 3 characters)");
      return;
    }

    setPending(true);
    try {
      const res = await api.payments.refund(payment.id, {
        amountKobo: refundKobo,
        reason: reason.trim(),
      });

      toast.success(
        `Refund of ${formatNairaFromKobo(refundKobo)} processed successfully`,
      );
      onSuccess(res.payment);
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, "Could not process refund"));
    } finally {
      setPending(false);
    }
  }

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Issue payment refund</DialogTitle>
          <DialogDescription>
            Record or process a refund for reference {payment.reference}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Original payment</span>
            <span className="font-medium text-foreground tabular-nums">
              {formatNairaFromKobo(payment.amountKobo)}
            </span>
          </div>
          {payment.refundedAmountKobo ? (
            <div className="flex justify-between text-amber-500">
              <span>Previously refunded</span>
              <span className="tabular-nums">
                {formatNairaFromKobo(payment.refundedAmountKobo)}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-border pt-1 font-semibold text-primary">
            <span>Remaining refundable</span>
            <span className="tabular-nums">{formatNairaFromKobo(refundableKobo)}</span>
          </div>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="refund-amount">Refund amount (₦)</Label>
            <Input
              id="refund-amount"
              type="number"
              min="1"
              step="any"
              value={amountNaira}
              onChange={(e) => setAmountNaira(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund-reason">Reason for refund</Label>
            <Input
              id="refund-reason"
              type="text"
              placeholder="e.g. Customer requested cancellation / Studio reschedule"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={3}
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
            <Button type="submit" variant="destructive" loading={pending}>
              Confirm Refund
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
