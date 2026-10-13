import { useEffect, useState } from "react";
import type { AvailableUpdate } from "../generated/AvailableUpdate";
import { t } from "../i18n";
import { api } from "../lib/api";

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const onThisComputer = () => ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);

// A newer release on GitHub: offered on the computer running the app (it
// restarts to install, so the person at it chooses when), never mid-check.
export function UpdateButton() {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [stage, setStage] = useState<"offer" | "confirm" | "installing" | "failed">("offer");

  useEffect(() => {
    if (!onThisComputer()) return;
    const check = () =>
      api
        .checkUpdate()
        .then((s) => setUpdate(s.available))
        .catch(() => undefined); // Offline: try again later.
    void check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    return () => window.clearInterval(timer);
  }, []);

  if (!update) return null;

  const install = async () => {
    setStage("installing");
    try {
      await api.installUpdate();
      // The app restarts by itself in a moment.
    } catch {
      setStage("failed");
    }
  };

  if (stage === "confirm") {
    return (
      <span className="flex items-center gap-2">
        <span className="text-cp-muted">{t("update.confirm", { version: update.version })}</span>
        <button type="button" onClick={() => void install()} className="cp-btn-live px-3 py-1">
          {t("update.install")}
        </button>
        <button type="button" onClick={() => setStage("offer")} className="cp-btn px-3 py-1">
          {t("update.later")}
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={stage === "installing"}
      onClick={() => setStage("confirm")}
      title={update.notes ?? undefined}
      className="rounded-cp border-cp px-2.5 py-1 text-cp-live hover:bg-cp-surface"
    >
      {stage === "installing"
        ? t("update.installing")
        : stage === "failed"
          ? t("update.failed")
          : t("update.available", { version: update.version })}
    </button>
  );
}
