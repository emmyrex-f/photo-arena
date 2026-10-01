import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock,
  CreditCard,
  Loader2,
  Sparkles,
  User,
} from "lucide-react";
import { Badge } from "../../admin/components/ui/badge";
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
import { Switch } from "../../admin/components/ui/switch";
import { Textarea } from "../../admin/components/ui/textarea";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import {
  formatLagosTime,
  formatNairaFromKobo,
  lagosToday,
} from "../../admin/lib/format";
import type { BookingRecord, PackageOption } from "../../admin/lib/types";
import { errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (booking: BookingRecord) => void;
  defaultDate?: string;
  defaultPackageId?: string;
  defaultServiceId?: string;
};

function validatePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "Phone number is required.";
  if (/[a-zA-Z]/.test(trimmed)) return "Phone number cannot contain letters.";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8) return "Phone number must have at least 8 digits.";
  if (digits.length > 16) return "Phone number cannot exceed 16 digits.";

  if (trimmed.startsWith("0")) {
    if (digits.length !== 11) {
      return "Nigerian numbers starting with 0 must have exactly 11 digits (e.g. 0803 123 4567).";
    }
  } else if (trimmed.startsWith("+234") || trimmed.startsWith("234")) {
    const localPart = digits.slice(3);
    if (localPart.length !== 10) {
      return "Nigerian numbers with +234 must have 10 digits after the country code.";
    }
  }
  return null;
}

export function CreateBookingDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultDate,
  defaultPackageId,
  defaultServiceId,
}: Props) {
  const api = useAdminApi();

  // Package & Availability state
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [date, setDate] = useState<string>(defaultDate || lagosToday());
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("");

  // Customer form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  // Optional Immediate Payment state
  const [collectPayment, setCollectPayment] = useState(false);
  const [channel, setChannel] = useState<"POS" | "CASH" | "TRANSFER">("POS");
  const [paymentAmountNaira, setPaymentAmountNaira] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // Load packages when dialog opens
  useEffect(() => {
    if (!open) return;
    let active = true;
    setPackagesLoading(true);
    api.bookings
      .packages()
      .then((pkgs) => {
        if (!active) return;
        setPackages(pkgs);
        if (pkgs.length > 0) {
          const matched = defaultPackageId
            ? pkgs.find((p) => p.id === defaultPackageId)
            : defaultServiceId
              ? pkgs.find((p) => p.serviceId === defaultServiceId || p.service?.id === defaultServiceId)
              : null;
          setSelectedPackageId(matched ? matched.id : pkgs[0]!.id);
        }
      })
      .catch((err) => {
        if (active) toast.error(`Failed to load packages: ${errorMessage(err)}`);
      })
      .finally(() => {
        if (active) setPackagesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, api, defaultPackageId, defaultServiceId]);

  const selectedPackage = useMemo(
    () => packages.find((p) => p.id === selectedPackageId),
    [packages, selectedPackageId],
  );

  // Update payment amount when selected package changes
  useEffect(() => {
    if (selectedPackage) {
      setPaymentAmountNaira(String(Math.round(selectedPackage.priceKobo / 100)));
    }
  }, [selectedPackage]);

  // Load available slots when date or selected package changes
  useEffect(() => {
    if (!open || !selectedPackage || !date) return;
    let active = true;
    setSlotsLoading(true);
    setSelectedSlot("");
    api.bookings
      .availability(date, selectedPackage.durationMinutes)
      .then((res) => {
        if (!active) return;
        setSlots(res.slots ?? []);
        if (res.slots && res.slots.length > 0) {
          setSelectedSlot(res.slots[0]!);
        }
      })
      .catch((err) => {
        if (active) {
          setSlots([]);
          toast.error(`Availability check failed: ${errorMessage(err)}`);
        }
      })
      .finally(() => {
        if (active) setSlotsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, selectedPackage, date, api]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setDate(defaultDate || lagosToday());
      setName("");
      setPhone("");
      setPhoneError(null);
      setEmail("");
      setNotes("");
      setCollectPayment(false);
      setChannel("POS");
      setPaymentRef("");
      setPaymentNote("");
    }
  }, [open, defaultDate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedPackage) {
      toast.error("Please select a service package");
      return;
    }
    if (!selectedSlot) {
      toast.error("Please select an available time slot");
      return;
    }
    if (!name.trim()) {
      toast.error("Customer name is required");
      return;
    }
    const pErr = validatePhone(phone);
    if (pErr) {
      setPhoneError(pErr);
      toast.error(pErr);
      return;
    }
    if (!email.trim()) {
      toast.error("Customer email is required for reminders and receipts");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create the booking
      const created = await api.bookings.create({
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim(),
        packageId: selectedPackage.id,
        startTime: selectedSlot,
        source: "WALK_IN",
        notes: notes.trim() || undefined,
      });

      // 2. Optionally record immediate payment
      if (collectPayment) {
        const payNaira = parseFloat(paymentAmountNaira);
        if (Number.isFinite(payNaira) && payNaira > 0) {
          const payKobo = Math.round(payNaira * 100);
          try {
            await api.bookings.recordPayment(created.id, {
              amountKobo: payKobo,
              channel,
              reference: paymentRef.trim() || undefined,
              note: paymentNote.trim() || "Studio payment collected at creation (WALK_IN)",
            });
            toast.success(
              `Booking ${created.reference ?? created.id} created & ₦${payNaira.toLocaleString()} ${channel} payment recorded!`,
            );
          } catch (payErr) {
            toast.error(
              `Booking created, but failed to record payment: ${errorMessage(payErr)}`,
            );
          }
        } else {
          toast.success(`Booking ${created.reference ?? created.id} created!`);
        }
      } else {
        toast.success(`Booking ${created.reference ?? created.id} created successfully!`);
      }

      onSuccess(created);
      onOpenChange(false);
    } catch (err) {
      toast.error(`Could not create booking: ${errorMessage(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto sm:p-6">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <Badge variant="outline" className="text-xs uppercase tracking-wide">
                Studio Desk
              </Badge>
            </div>
            <DialogTitle className="font-display text-2xl font-normal">
              New Studio Booking
            </DialogTitle>
            <DialogDescription>
              Book a walk-in or telephone reservation directly on the studio calendar.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-5">
            {/* Step 1: Package Selection */}
            <div className="space-y-2">
              <Label htmlFor="create-booking-package">Select Package *</Label>
              {packagesLoading ? (
                <div className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading packages...
                </div>
              ) : (
                <Select
                  value={selectedPackageId}
                  onValueChange={setSelectedPackageId}
                >
                  <SelectTrigger id="create-booking-package" className="h-auto py-2.5">
                    <SelectValue placeholder="Select a package" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {packages.map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id} className="py-2">
                        <div className="flex flex-col text-left">
                          <span className="font-medium text-foreground">
                            {pkg.service?.name ? `${pkg.service.name} — ` : ""}
                            {pkg.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {pkg.durationMinutes} min · {formatNairaFromKobo(pkg.priceKobo)}
                            {pkg.includes ? ` · ${pkg.includes}` : ""}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Step 2: Date & Slot Selection */}
            <div className="space-y-2">
              <Label htmlFor="create-booking-date">Date *</Label>
              <Input
                id="create-booking-date"
                type="date"
                min={lagosToday()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="max-w-xs"
                required
              />
            </div>

            {/* Time Slot Picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Available Time Slots *
                </Label>
                {selectedPackage && (
                  <span className="text-xs text-muted-foreground">
                    Duration: {selectedPackage.durationMinutes} mins
                  </span>
                )}
              </div>

              {slotsLoading ? (
                <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
                  Checking studio availability...
                </div>
              ) : slots.length === 0 ? (
                <div className="rounded-lg border border-dashed border-destructive/50 bg-destructive/10 p-3 text-center text-sm text-destructive">
                  No slots available for this package on this date (studio may be closed or fully booked).
                </div>
              ) : (
                <div className="grid max-h-40 grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-border bg-card/40 p-2 sm:grid-cols-4 md:grid-cols-5">
                  {slots.map((slot) => {
                    const isSelected = selectedSlot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={cn(
                          "flex items-center justify-center gap-1 rounded-md px-2.5 py-2 text-xs font-medium transition-all",
                          isSelected
                            ? "border border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border border-border bg-card hover:bg-muted/70 hover:text-foreground text-muted-foreground",
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-[2.5]" />}
                        <span className="tabular-nums">{formatLagosTime(slot)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 3: Customer Information */}
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <User className="h-4 w-4 text-primary" /> Customer Details
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="create-booking-name">Full Name *</Label>
                  <Input
                    id="create-booking-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Chioma Okonkwo"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="create-booking-phone">Phone Number *</Label>
                  <Input
                    id="create-booking-phone"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (phoneError) setPhoneError(validatePhone(e.target.value));
                    }}
                    onBlur={() => setPhoneError(validatePhone(phone))}
                    placeholder="e.g. 0803 123 4567 or +234..."
                    className={cn(phoneError && "border-destructive focus-visible:ring-destructive")}
                    required
                  />
                  {phoneError && (
                    <p className="text-xs text-destructive">{phoneError}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="create-booking-email">
                    Email Address <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="create-booking-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="customer@example.com"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="create-booking-notes">
                    Studio Notes <span className="text-xs text-muted-foreground">(Optional)</span>
                  </Label>
                  <Textarea
                    id="create-booking-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Shoot preferences, extra outfits, etc."
                    rows={2}
                    className="min-h-[2.5rem] resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Step 4: Optional Immediate Payment Collection */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="collect-payment-switch" className="text-sm font-semibold flex items-center gap-1.5 cursor-pointer">
                    <CreditCard className="h-4 w-4 text-primary" />
                    Collect Studio Payment Now
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Record POS, Cash, or Bank Transfer deposit/balance immediately upon booking.
                  </p>
                </div>
                <Switch
                  id="collect-payment-switch"
                  checked={collectPayment}
                  onCheckedChange={setCollectPayment}
                />
              </div>

              {collectPayment && (
                <div className="pt-2 border-t border-border grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="payment-channel">Payment Channel</Label>
                    <Select
                      value={channel}
                      onValueChange={(v: "POS" | "CASH" | "TRANSFER") => setChannel(v)}
                    >
                      <SelectTrigger id="payment-channel">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="POS">POS (Debit Card)</SelectItem>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="TRANSFER">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="payment-amount">Amount (₦)</Label>
                    <Input
                      id="payment-amount"
                      type="number"
                      min="1"
                      step="1"
                      value={paymentAmountNaira}
                      onChange={(e) => setPaymentAmountNaira(e.target.value)}
                      placeholder="Amount in Naira"
                      required={collectPayment}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="payment-ref">Reference / Receipt #</Label>
                    <Input
                      id="payment-ref"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      placeholder="e.g. POS-88492"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6 flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || slotsLoading || !selectedSlot}
              className="gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating Booking...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Confirm Booking
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
