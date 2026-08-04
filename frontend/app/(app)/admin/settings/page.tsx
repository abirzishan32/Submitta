import type { Metadata } from "next";
import { api } from "@/lib/api/server";
import type { SettingDto } from "@/lib/api/types";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const settings = await api.get<SettingDto[]>("/api/v1/settings");
  return <SettingsView initial={settings} />;
}
