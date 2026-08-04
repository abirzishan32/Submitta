"use client";

import { useState } from "react";
import { Check, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/common/page-header";
import { StatusPill } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { FadeInUp } from "@/components/motion/primitives";
import { apiClient, ClientApiError } from "@/lib/api/client";
import { useTranslation } from "@/components/providers/i18n-provider";
import type { SettingDto } from "@/lib/api/types";

/**
 * Application settings.
 *
 * Each row saves independently rather than the page having one Save button:
 * these values are unrelated to each other, and a single form would make
 * changing one setting look like it committed all of them.
 */
export function SettingsView({ initial }: { initial: SettingDto[] }) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(initial);

  return (
    <div className="space-y-5">
      <PageHeader title={t.settings.title} description={t.settings.subtitle} />

      {settings.length === 0 ? (
        <EmptyState icon={Settings2} title={t.common.noResults} />
      ) : (
        <FadeInUp delay={0.04} className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {settings.map((setting) => (
            <SettingRow
              key={setting.id}
              setting={setting}
              onSaved={(updated) =>
                setSettings((current) =>
                  current.map((item) => (item.id === updated.id ? updated : item)),
                )
              }
            />
          ))}
        </FadeInUp>
      )}
    </div>
  );
}

function SettingRow({
  setting,
  onSaved,
}: {
  setting: SettingDto;
  onSaved: (updated: SettingDto) => void;
}) {
  const { t } = useTranslation();

  const [value, setValue] = useState(setting.value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = value !== setting.value;
  const isBoolean = setting.dataType === "boolean";

  async function save(next: string) {
    setSaving(true);
    setError(null);

    try {
      const updated = await apiClient.put<SettingDto>(
        `/api/v1/settings/${encodeURIComponent(setting.key)}`,
        { value: next },
      );

      onSaved(updated);
      setValue(updated.value);
      toast.success(t.settings.updated);
    } catch (err) {
      // The API rejects a value that does not parse as the declared type.
      setError(err instanceof ClientApiError ? err.message : t.errors.generic);
      setValue(setting.value);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-[family-name:var(--font-mono-code)] text-sm">{setting.key}</p>
          <StatusPill tone={setting.isPublic ? "info" : "neutral"}>
            {setting.isPublic ? t.settings.public : t.settings.private}
          </StatusPill>
        </div>

        {setting.description ? (
          <p className="text-xs text-muted-foreground text-pretty">{setting.description}</p>
        ) : null}

        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isBoolean ? (
          // A boolean commits on click — a Save button next to a toggle is
          // an extra step with no decision behind it.
          <button
            type="button"
            role="switch"
            aria-checked={value === "true"}
            aria-label={setting.key}
            disabled={saving}
            onClick={() => save(value === "true" ? "false" : "true")}
            className={cn(
              "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              value === "true" ? "bg-primary" : "bg-muted-foreground/30",
              saving && "opacity-60",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-4 rounded-full bg-background shadow-[var(--shadow-subtle)] transition-transform duration-200",
                value === "true" ? "translate-x-[1.125rem]" : "translate-x-0.5",
              )}
            />
          </button>
        ) : (
          <>
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              inputMode={
                setting.dataType === "integer" || setting.dataType === "decimal"
                  ? "numeric"
                  : "text"
              }
              aria-label={setting.key}
              className={cn("h-8 w-48", setting.dataType !== "string" && "tabular")}
            />
            <Button
              size="sm"
              variant={dirty ? "default" : "outline"}
              disabled={!dirty || saving}
              onClick={() => save(value)}
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Check className="size-3.5" aria-hidden />
              )}
              {t.common.save}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
