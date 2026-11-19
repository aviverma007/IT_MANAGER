import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

function useEscape(open: boolean, onClose: () => void) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [open, onClose]);
}

export function Modal({ open, onClose, title, description, children, footer, size = "md", icon }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl"; icon?: React.ReactNode;
}) {
  useEscape(open, onClose);
  const width = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[8vh]">
          <motion.div className="fixed inset-0 bg-black/55 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 30, scale: 0.94, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 20, scale: 0.96, filter: "blur(6px)" }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className={cn("glass relative mb-10 w-full rounded-3xl !bg-popover/95", width)}
          >
            <div className="flex items-start gap-3 border-b border-border px-6 py-5">
              {icon && <div className="emboss grid size-10 shrink-0 place-items-center rounded-xl text-primary">{icon}</div>}
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
              </div>
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close"><X /></Button>
            </div>
            <div className="px-6 py-5">{children}</div>
            {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEscape(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div className="absolute inset-0 bg-black/45 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-label={title}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className={`glass absolute inset-y-0 right-0 flex w-full ${wide ? "max-w-3xl" : "max-w-lg"} flex-col !rounded-none !bg-popover/95`}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">{title}</h2>
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close"><X /></Button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-border px-6 py-4">{footer}</div>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ---------- confirm() as a promise ---------- */
type ConfirmOptions = { title: string; message?: string; confirm?: string; danger?: boolean };
const ConfirmContext = React.createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const ask = React.useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => { state?.resolve(v); setState(null); };
  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title ?? ""}
        size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
          <Button variant={state?.danger ? "danger" : "primary"} onClick={() => close(true)} autoFocus>{state?.confirm ?? "Confirm"}</Button>
        </>}
      >
        <p className="text-sm text-muted-foreground">{state?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => React.useContext(ConfirmContext);
