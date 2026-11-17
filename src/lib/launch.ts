import { call } from "@/api/client";
import type { AppSummary } from "@/core/types";

/** Open an application's link in a new tab and record the launch (counts toward usage). */
export function openApp(app: Pick<AppSummary, "id" | "url">, url = app.url) {
  if (!url) return;
  window.open(url, "_blank", "noopener");
  void call("apps.launch", { id: app.id }).catch(() => undefined);
}
