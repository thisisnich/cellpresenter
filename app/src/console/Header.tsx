import { useEffect, useState } from "react";
import { t } from "../i18n";
import { api } from "../lib/api";
import { DisplayLink } from "./DisplayLink";
import { PANEL_KINDS, type PanelKind } from "./layout";
import { PAGES, type Page } from "./pages";
import { useLive } from "./LiveContext";
import { UpdateButton } from "./UpdateButton";

function useClock(): string {
  const format = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const [now, setNow] = useState(format);
  useEffect(() => {
    const id = window.setInterval(() => setNow(format()), 10_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}


export function Header({
  page,
  onPage,
  onResetLayout,
  onAddPanel,
}: {
  /** The console page in front. */
  page: Page;
  onPage: (page: Page) => void;
  onResetLayout: () => void;
  onAddPanel: (kind: PanelKind) => void;
}) {
  const [layoutOpen, setLayoutOpen] = useState(false);
  const { status } = useLive();
  const clock = useClock();
  const [pin, setPin] = useState<string | null>(null);
  useEffect(() => {
    api
      .pin()
      .then((info) => setPin(info.pin))
      .catch(() => setPin(null)); // Only the laptop running the app may see it.
  }, []);

  return (
    <header className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b-cp bg-cp-chrome px-4 font-ui text-[13px] text-cp-text">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-bold tracking-tight">{t("app.name")}</span>
        <div className="flex rounded-cp border-cp bg-cp-bg p-0.5" role="group">
          {PAGES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onPage(m)}
              title={t(`mode.${m}Help`)}
              aria-pressed={page === m}
              className={`rounded-cp-sm px-3.5 py-1 ${page === m ? "bg-cp-surface-hi font-semibold" : "text-cp-muted hover:text-cp-text"}`}
            >
              {t(`mode.${m}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label={t("layout.label")}>
          <button
            type="button"
            onClick={() => setLayoutOpen((o) => !o)}
            aria-expanded={layoutOpen}
            className={`rounded-cp border-cp px-2.5 py-1 ${layoutOpen ? "bg-cp-surface-hi text-cp-text" : "text-cp-muted hover:text-cp-text"}`}
          >
            {t("layout.label")} {layoutOpen ? "‹" : "›"}
          </button>
          {layoutOpen && (
            <>
              <label className="sr-only" htmlFor="add-panel">
                {t("layout.add")}
              </label>
              <select
                id="add-panel"
                value=""
                onChange={(e) => e.target.value && onAddPanel(e.target.value as PanelKind)}
                title={t("layout.addHelp")}
                className="h-[30px] rounded-cp border-cp bg-cp-bg px-2 text-cp-text"
              >
                <option value="">{t("layout.add")}</option>
                {PANEL_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`panel.${kind}`)}
                  </option>
                ))}
              </select>
              <button type="button" onClick={onResetLayout} title={t("layout.resetHelp")} className="rounded-cp border-cp px-2.5 py-1 text-cp-muted hover:text-cp-text">
                {t("layout.reset")}
              </button>
            </>
          )}
        </div>
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
        <UpdateButton />
        <DisplayLink />
      </div>
    </header>
  );
}
