import { useState, type ReactNode } from "react";
import { errorMessage } from "../../../lib/api";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog";
import { Button } from "./button";
import { toast } from "./toaster";

type ConfirmDialogProps = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<unknown> | unknown;
  /** Toast shown after success. */
  successMessage?: string;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
};

/**
 * Confirmation dialog for destructive / irreversible actions.
 * Either pass `trigger` (uncontrolled) or control it with `open`/`onOpenChange`.
 */
function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  onConfirm,
  successMessage,
  trigger,
  open,
  onOpenChange,
  children,
}: ConfirmDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
      if (successMessage) toast.success(successMessage);
      setOpen(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant={destructive ? "destructive" : "default"} onClick={handleConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { ConfirmDialog };
export { useModal, useConfirm, useAlert, usePrompt, modal } from "../../../components/ui/ModalProvider";
export type {
  ModalTone,
  ModalIconType,
  ConfirmModalOptions,
  AlertModalOptions,
  PromptModalOptions,
} from "../../../components/ui/ModalProvider";
