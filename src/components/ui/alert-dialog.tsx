import { AlertTriangle } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { Button } from "./button";

interface AlertDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function AlertDialog({
  open,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  onConfirm,
  onOpenChange,
}: AlertDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-4">
      <button
        aria-label="关闭确认框"
        className="absolute inset-0 cursor-default"
        onClick={() => onOpenChange(false)}
      />
      <section
        aria-modal="true"
        role="alertdialog"
        className="relative w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5 text-[var(--text)] shadow-[var(--shadow-soft)]"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-[var(--panel-soft)] p-2 text-[var(--muted)]">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{title}</h2>
            {description ? (
              <div className="mt-2 text-sm leading-6 text-[var(--subtle)]">
                {description}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}
