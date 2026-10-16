import { useEffect, useRef, useState } from "react";
import type { Look } from "../generated/Look";
import { t } from "../i18n";
import { api, ApiError } from "../lib/api";
import { useLive } from "./LiveContext";

/**
 * The screens' look, for editing: changes show here at once and reach the
 * server a moment later, so a dragged slider or box doesn't send a request
 * per pixel. Every display follows once it's saved.
 */
export function useLookDraft() {
  const { state } = useLive();
  const [draft, setDraft] = useState<Look | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const look = draft ?? state?.look ?? null;

  const send = async (next: Look) => {
    setError(null);
    try {
      await api.setLook(next);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      setError(
        code === "pin_required" ? t("screen.needPin") : code === "licence_too_long" ? t("screen.licenceTooLong") : t("screen.saveFailed"),
      );
    } finally {
      setDraft((d) => (d === next ? null : d));
    }
  };

  const change = (patch: Partial<Look>, delay = 0) => {
    if (!look) return;
    const next = { ...look, ...patch };
    setDraft(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void send(next), delay);
  };

  return { state, look, change, error };
}
