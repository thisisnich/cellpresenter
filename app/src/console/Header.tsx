import { useEffect, useState } from "react";
import { t } from "../i18n";
import { api } from "../lib/api";
import { ROUTES } from "../lib/routes";
import { useLive } from "./LiveContext";

function useClock(): string {
  const format = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const [now, setNow] = useState(format);
  useEffect(() => {
    const id = window.setInterval(() => setNow(format()), 10_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

const MODES = [
  { key: "mode.show", enabled: true },
  { key: "mode.edit", enabled: false },
  { key: "mode.chords", enabled: false },
] as const;

export function Header({ onResetLayout }: { onResetLayout: () => void }) {
  const { status } = useLive();
  const clock = useClock();
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const displayUrl = `${location.protocol}//${location.host}${ROUTES.display}`;
  const [pin, setPin] = useState<string | null>(null);
  useEffect(() => {
    api
      .pin()
      .then((info) => setPin(info.pin))
      .catch(() => setPin(null)); // Only the laptop running the app may see it.
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(displayUrl);
      setCopied("copied");
      window.setTimeout(() => setCopied("idle"), 1500);
    } catch {
      // Clipboard blocked: show the address so it can be typed or selected.
      setCopied("failed");
    }
  };

  return (
    <header className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b-cp bg-cp-chrome px-4 font-ui text-[13px] text-cp-text">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-bold tracking-tight">{t("app.name")}</span>
        <div className="flex rounded-cp border-cp bg-cp-bg p-0.5" role="group">
          {MODES.map((mode) => (
            <button
              key={mode.key}
              type="button"
              disabled={!mode.enabled}
              title={mode.enabled ? undefined : t("mode.comingSoon")}
              aria-pressed={mode.enabled}
              className={`rounded-cp-sm px-3.5 py-1 ${
                mode.enabled ? "bg-cp-surface-hi font-semibold" : "text-cp-muted disabled:cursor-not-allowed"
              }`}
            >
              {t(mode.key)}
            </button>
          ))}
        </div>
        <button type="button" onClick={onResetLayout} className="rounded-cp border-cp px-2.5 py-1 text-cp-muted hover:text-cp-text">
          {t("layout.reset")}
        </button>
      </div>
      <div className="flex items-center gap-4 text-cp-muted">
        {pin && (
          <span title={t("header.remotePinHelp")} className="inline-flex items-center gap-1.5">
            {t("header.remotePin")}
            <span className="rounded-cp-sm border-cp bg-cp-bg px-1.5 py-0.5 font-mono text-[13px] tracking-widest text-cp-text">
              {pin}
            </span>
          </span>
        )}
        <span className="font-mono text-[15px] text-cp-text tabular-nums">{clock}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`size-[7px] rounded-full ${status === "open" ? "bg-cp-ok" : "bg-cp-danger"}`} />
          {t(`connection.${status}`)}
        </span>
        {copied === "failed" && <span className="font-mono text-[12px] text-cp-text select-all">{displayUrl}</span>}
        <button type="button" onClick={copyLink} className="cp-btn" title={displayUrl}>
          {copied === "copied" ? t("header.copied") : t("header.copyDisplayLink")}
        </button>
      </div>
    </header>
  );
}
