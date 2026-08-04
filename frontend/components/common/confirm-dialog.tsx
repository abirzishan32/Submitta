"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/components/providers/i18n-provider";

/**
 * Confirmation before an action that cannot be undone.
 *
 * The description states the specific consequence rather than asking "are you
 * sure?" — a dialog that names what will happen is the difference between a
 * considered decision and a reflex click. The confirm button stays disabled
 * while the request is in flight, so a slow network cannot produce two deletes.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = true,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const [working, setWorking] = useState(false);

  async function confirm() {
    setWorking(true);

    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-pretty">{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={working}
          >
            {t.common.cancel}
          </Button>

          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={confirm}
            disabled={working}
          >
            {working ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {confirmLabel ?? t.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
