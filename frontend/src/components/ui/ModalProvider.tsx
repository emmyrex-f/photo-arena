import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  HelpCircle,
  Info,
  LogOut,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "../../lib/cn";

export type ModalTone = "danger" | "warning" | "info" | "success" | "neutral";
export type ModalIconType =
  | "trash"
  | "archive"
  | "alert"
  | "logout"
  | "shield"
  | "info"
  | "success"
  | "help"
  | ReactNode;

export type ConfirmModalOptions = {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  tone?: ModalTone;
  icon?: ModalIconType;
};

export type AlertModalOptions = {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: ModalTone;
  icon?: ModalIconType;
};

export type PromptModalOptions = {
  title: ReactNode;
  description?: ReactNode;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputType?: "text" | "password" | "email" | "number";
  required?: boolean;
  tone?: ModalTone;
  icon?: ModalIconType;
  validationError?: (value: string) => string | null | undefined;
};

type ActiveModal =
  | {
      type: "confirm";
      options: ConfirmModalOptions;
      resolve: (value: boolean) => void;
    }
  | {
      type: "alert";
      options: AlertModalOptions;
      resolve: () => void;
    }
  | {
      type: "prompt";
      options: PromptModalOptions;
      resolve: (value: string | null) => void;
    };

export type ModalContextValue = {
  confirm: (options: ConfirmModalOptions | string) => Promise<boolean>;
  alert: (options: AlertModalOptions | string) => Promise<void>;
  prompt: (options: PromptModalOptions | string) => Promise<string | null>;
};

const ModalContext = createContext<ModalContextValue | null>(null);

// Global modal ref for standalone / outside-hook calls if needed
let globalModal: ModalContextValue | null = null;

export const modal = {
  confirm: (options: ConfirmModalOptions | string) => {
    if (!globalModal) {
      // Fallback if provider not mounted yet
      const message = typeof options === "string" ? options : String(options.title);
      return Promise.resolve(window.confirm(message));
    }
    return globalModal.confirm(options);
  },
  alert: (options: AlertModalOptions | string) => {
    if (!globalModal) {
      const message = typeof options === "string" ? options : String(options.title);
      window.alert(message);
      return Promise.resolve();
    }
    return globalModal.alert(options);
  },
  prompt: (options: PromptModalOptions | string) => {
    if (!globalModal) {
      const message = typeof options === "string" ? options : String(options.title);
      return Promise.resolve(window.prompt(message));
    }
    return globalModal.prompt(options);
  },
};

function renderModalIcon(icon: ModalIconType | undefined, tone: ModalTone) {
  if (React.isValidElement(icon)) return icon;

  const iconClasses = "h-5 w-5";

  if (icon === "trash") return <Trash2 className={iconClasses} />;
  if (icon === "archive") return <Archive className={iconClasses} />;
  if (icon === "logout") return <LogOut className={iconClasses} />;
  if (icon === "shield") return <ShieldAlert className={iconClasses} />;
  if (icon === "info") return <Info className={iconClasses} />;
  if (icon === "success") return <CheckCircle2 className={iconClasses} />;
  if (icon === "alert") return <AlertTriangle className={iconClasses} />;
  if (icon === "help") return <HelpCircle className={iconClasses} />;

  // Default icons derived from tone
  switch (tone) {
    case "danger":
      return <Trash2 className={iconClasses} />;
    case "warning":
      return <AlertTriangle className={iconClasses} />;
    case "success":
      return <CheckCircle2 className={iconClasses} />;
    case "info":
      return <Info className={iconClasses} />;
    default:
      return <HelpCircle className={iconClasses} />;
  }
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [activeModal, setActiveModal] = useState<ActiveModal | null>(null);
  const [promptInput, setPromptInput] = useState("");
  const [promptError, setPromptError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((options: ConfirmModalOptions | string): Promise<boolean> => {
    const opts: ConfirmModalOptions =
      typeof options === "string"
        ? {
            title: options,
            tone: "warning",
            confirmLabel: "Confirm",
          }
        : {
            ...options,
            tone: options.tone ?? (options.destructive ? "danger" : "warning"),
          };

    return new Promise<boolean>((resolve) => {
      setActiveModal({
        type: "confirm",
        options: opts,
        resolve: (val) => {
          setActiveModal(null);
          resolve(val);
        },
      });
    });
  }, []);

  const alert = useCallback((options: AlertModalOptions | string): Promise<void> => {
    const opts: AlertModalOptions =
      typeof options === "string"
        ? {
            title: options,
            tone: "info",
            confirmLabel: "OK",
          }
        : {
            ...options,
            tone: options.tone ?? "info",
          };

    return new Promise<void>((resolve) => {
      setActiveModal({
        type: "alert",
        options: opts,
        resolve: () => {
          setActiveModal(null);
          resolve();
        },
      });
    });
  }, []);

  const prompt = useCallback((options: PromptModalOptions | string): Promise<string | null> => {
    const opts: PromptModalOptions =
      typeof options === "string"
        ? {
            title: options,
            tone: "neutral",
            confirmLabel: "Submit",
          }
        : {
            ...options,
            tone: options.tone ?? "neutral",
          };

    setPromptInput(opts.defaultValue ?? "");
    setPromptError(null);

    return new Promise<string | null>((resolve) => {
      setActiveModal({
        type: "prompt",
        options: opts,
        resolve: (val) => {
          setActiveModal(null);
          resolve(val);
        },
      });
    });
  }, []);

  // Sync global helper ref
  useEffect(() => {
    globalModal = { confirm, alert, prompt };
    return () => {
      globalModal = null;
    };
  }, [confirm, alert, prompt]);

  // Focus management & keyboard shortcuts
  useEffect(() => {
    if (!activeModal) return;

    const timeout = setTimeout(() => {
      if (activeModal.type === "prompt" && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      } else if (confirmButtonRef.current) {
        confirmButtonRef.current.focus();
      }
    }, 50);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (activeModal?.type === "confirm") activeModal.resolve(false);
        else if (activeModal?.type === "alert") activeModal.resolve();
        else if (activeModal?.type === "prompt") activeModal.resolve(null);
      } else if (e.key === "Enter" && activeModal?.type === "prompt") {
        if (e.target === inputRef.current) {
          e.preventDefault();
          handlePromptSubmit();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeModal, promptInput]);

  function handlePromptSubmit() {
    if (activeModal?.type !== "prompt") return;
    const { options, resolve } = activeModal;

    if (options.required && !promptInput.trim()) {
      setPromptError("This field is required.");
      return;
    }

    if (options.validationError) {
      const err = options.validationError(promptInput);
      if (err) {
        setPromptError(err);
        return;
      }
    }

    resolve(promptInput);
  }

  return (
    <ModalContext.Provider value={{ confirm, alert, prompt }}>
      {children}

      {activeModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
        >
          {/* Backdrop with soft blur */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity animate-in fade-in-0 duration-200"
            onClick={() => {
              if (activeModal.type === "confirm") activeModal.resolve(false);
              else if (activeModal.type === "alert") activeModal.resolve();
              else if (activeModal.type === "prompt") activeModal.resolve(null);
            }}
          />

          {/* Dialog Card Container - Solid Opaque Background */}
          <div
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-[#18191c] p-6 text-[#f3f4f6] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] ring-1 ring-black/40 transition-all animate-in fade-in-0 zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close X */}
            <button
              type="button"
              onClick={() => {
                if (activeModal.type === "confirm") activeModal.resolve(false);
                else if (activeModal.type === "alert") activeModal.resolve();
                else if (activeModal.type === "prompt") activeModal.resolve(null);
              }}
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#a5a7aa] transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header & Icon */}
            {(() => {
              const tone = activeModal.options.tone ?? "neutral";
              const icon = activeModal.options.icon;

              const toneBadgeStyles: Record<ModalTone, string> = {
                danger: "bg-red-500/15 text-red-400 ring-1 ring-red-500/30",
                warning: "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/35",
                info: "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30",
                success: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30",
                neutral: "bg-white/10 text-white/80 ring-1 ring-white/15",
              };

              return (
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                      toneBadgeStyles[tone],
                    )}
                  >
                    {renderModalIcon(icon, tone)}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5 pr-6">
                    <h3 className="text-base font-semibold tracking-tight text-white sm:text-lg font-display">
                      {activeModal.options.title}
                    </h3>
                    {activeModal.options.description && (
                      <div className="mt-1.5 text-sm text-[#a5a7aa] leading-relaxed">
                        {activeModal.options.description}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Prompt Input Area */}
            {activeModal.type === "prompt" && (
              <div className="mt-5 space-y-2">
                <input
                  ref={inputRef}
                  type={activeModal.options.inputType ?? "text"}
                  value={promptInput}
                  onChange={(e) => {
                    setPromptInput(e.target.value);
                    if (promptError) setPromptError(null);
                  }}
                  placeholder={activeModal.options.placeholder}
                  className={cn(
                    "w-full rounded-xl border border-white/15 bg-[#101112] px-3.5 py-2.5 text-sm text-white placeholder:text-[#74777b] shadow-inner transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60",
                    promptError && "border-red-500 focus:ring-red-500/30",
                  )}
                />
                {promptError && (
                  <p className="text-xs font-medium text-red-400 animate-in fade-in-0">
                    {promptError}
                  </p>
                )}
              </div>
            )}

            {/* Actions Footer */}
            <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              {activeModal.type !== "alert" && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeModal.type === "confirm") activeModal.resolve(false);
                    else if (activeModal.type === "prompt") activeModal.resolve(null);
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-medium text-[#f3f4f6] transition-all hover:bg-white/10 hover:text-white active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                >
                  {(activeModal.options as ConfirmModalOptions).cancelLabel ?? "Cancel"}
                </button>
              )}

              {activeModal.type === "confirm" && (
                <button
                  ref={confirmButtonRef}
                  type="button"
                  onClick={() => activeModal.resolve(true)}
                  className={cn(
                    "inline-flex h-10 items-center justify-center rounded-xl px-5 text-sm font-semibold shadow-md transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-[#18191c]",
                    activeModal.options.destructive || activeModal.options.tone === "danger"
                      ? "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/50"
                      : activeModal.options.tone === "warning"
                      ? "bg-[#e67e22] text-white hover:bg-[#d35400] focus-visible:ring-amber-500/50"
                      : "bg-[#d8b477] text-[#111111] hover:bg-[#c9a56a] focus-visible:ring-[#d8b477]/50",
                  )}
                >
                  {activeModal.options.confirmLabel ?? "Confirm"}
                </button>
              )}

              {activeModal.type === "alert" && (
                <button
                  ref={confirmButtonRef}
                  type="button"
                  onClick={() => activeModal.resolve()}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-[#d8b477] px-5 text-sm font-semibold text-[#111111] shadow-md transition-all hover:bg-[#c9a56a] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b477]/50"
                >
                  {activeModal.options.confirmLabel ?? "OK"}
                </button>
              )}

              {activeModal.type === "prompt" && (
                <button
                  type="button"
                  onClick={handlePromptSubmit}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-[#d8b477] px-5 text-sm font-semibold text-[#111111] shadow-md transition-all hover:bg-[#c9a56a] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b477]/50"
                >
                  {activeModal.options.confirmLabel ?? "Submit"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    // Return fallback helpers that delegate to singleton or window
    return {
      confirm: (options) => modal.confirm(options),
      alert: (options) => modal.alert(options),
      prompt: (options) => modal.prompt(options),
    };
  }
  return ctx;
}

export function useConfirm() {
  const { confirm } = useModal();
  return confirm;
}

export function useAlert() {
  const { alert } = useModal();
  return alert;
}

export function usePrompt() {
  const { prompt } = useModal();
  return prompt;
}
