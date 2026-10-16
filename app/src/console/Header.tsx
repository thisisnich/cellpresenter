import { useEffect, useState } from "react";
import { t } from "../i18n";
import { api, type OutsideLink } from "../lib/api";
import { DisplayLink } from "./DisplayLink";
import { PANEL_KINDS, type PanelKind } from "./layout";
import { PAGES, type Page } from "./pages";
import { useLive } from "./LiveContext";
import { useGuide } from "./FirstRunGuide";
import { UpdateButton } from "./UpdateButton";
import { Mark } from "../brand/Mark";

const NEW_ISSUE = "https://github.com/thisisnich/cellpresenter/issues/new";
const TIP_JAR = "https://ko-fi.com/ndubs";
const THIS_VERSION = `https://github.com/thisisnich/cellpresenter/blob/v${__APP_VERSION__}`;
const PAGES_OUT = { tip: TIP_JAR, license: `${THIS_VERSION}/LICENSE`, privacy: `${THIS_VERSION}/PRIVACY.md` };
const onThisComputer = () => ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);

// The computer opens its own browser (issues with the version filled in); a
// phone or another computer opens the page in its own browser.
function openLink(link: OutsideLink) {
  const plain = () =>
    window.open(link === "bug" || link === "feature" ? `${NEW_ISSUE}?template=${link}.yml` : PAGES_OUT[link], "_blank", "noopener");
  if (!onThisComputer()) return plain();
  api.openLink(link).catch(plain);
}

/** Who makes CellPresenter, and a way to say thanks. Only when asked for. */
function About({ onBack }: { onBack: () => void }) {
  // The running app's version; this page's own build until it answers.
  const [version, setVersion] = useState(__APP_VERSION__);
  useEffect(() => {
    api
      .health()
      .then((h) => setVersion(h.version))
      .catch(() => {});
  }, []);
  return (
    <div className="flex flex-col gap-3 p-3">
      <div>
        <h2 className="m-0 text-sm font-semibold">{t("about.title")}</h2>
        <p className="m-0 mt-0.5 text-[12px] text-cp-muted">{t("about.version", { version })}</p>
      </div>
      <p className="m-0 leading-relaxed whitespace-pre-line text-cp-muted">{t("about.body")}</p>
      <p className="m-0 text-[12px] leading-relaxed text-cp-muted">
        {t("about.license")}{" "}
        <button type="button" onClick={() => openLink("license")} title={t("about.licenseHelp")} className="text-cp-text underline underline-offset-2 hover:text-cp-live">
          {t("about.licenseRead")}
        </button>{" "}
        ·{" "}
        <button type="button" onClick={() => openLink("privacy")} title={t("about.privacyHelp")} className="text-cp-text underline underline-offset-2 hover:text-cp-live">
          {t("about.privacy")}
        </button>
      </p>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="cp-btn px-3 py-1">
          {t("about.back")}
        </button>
        <button type="button" onClick={() => openLink("tip")} title={t("about.tipHelp")} className="cp-btn px-3 py-1">
          {t("about.tip")}
        </button>
      </div>
    </div>
  );
}

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
  settingsOpen,
  onSettings,
}: {
  /** The console page in front. */
  page: Page;
  /** Whether the Settings page is showing instead of a console page. */
  settingsOpen: boolean;
  onSettings: () => void;
  onPage: (page: Page) => void;
  onResetLayout: () => void;
  onAddPanel: (kind: PanelKind) => void;
}) {
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const { status } = useLive();
  const clock = useClock();
  const guide = useGuide();
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
        <span className="inline-flex items-center gap-2 text-sm font-bold tracking-tight">
          <Mark size={20} />
          {t("app.name")}
        </span>
        <div className="flex rounded-cp border-cp bg-cp-bg p-0.5" role="group">
          {PAGES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onPage(m)}
              title={t(`mode.${m}Help`)}
              aria-pressed={page === m && !settingsOpen}
              className={`rounded-cp-sm px-3.5 py-1 ${page === m && !settingsOpen ? "bg-cp-surface-hi font-semibold" : "text-cp-muted hover:text-cp-text"}`}
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
            data-guide="layout"
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
      <div className="flex items-center gap-4 text-cp-muted" data-guide="status">
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
        <button
          type="button"
          onClick={onSettings}
          aria-pressed={settingsOpen}
          title={t("settings.open")}
          className={`rounded-cp border-cp px-2.5 py-1 ${settingsOpen ? "bg-cp-surface-hi text-cp-text" : "text-cp-muted hover:text-cp-text"}`}
        >
          {t("settings.open")}
        </button>
        <div
          className="relative"
          onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setGuideOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setGuideOpen(false)}
        >
          <button
            type="button"
            onClick={() => {
              setGuideOpen((o) => !o);
              setAboutOpen(false);
            }}
            aria-expanded={guideOpen}
            aria-label={t("guide.open")}
            title={t("guide.open")}
            data-guide="guide"
            className="size-8 rounded-full border-cp text-cp-muted hover:text-cp-text"
          >
            ?
          </button>
          {guideOpen && (
            <div className={`absolute right-0 top-10 z-30 flex flex-col rounded-cp border-cp bg-cp-chrome p-1 shadow-2xl ${aboutOpen ? "w-80" : "w-56"}`}>
              {aboutOpen ? (
                <About onBack={() => setAboutOpen(false)} />
              ) : (
                <>
                  {(["start", page] as const).map((tour) => (
                    <button
                      key={tour}
                      type="button"
                      onClick={() => {
                        setGuideOpen(false);
                        guide?.open(tour);
                      }}
                      className="rounded-cp-sm px-3 py-2 text-left text-cp-text hover:bg-cp-surface-hi"
                    >
                      {tour === "start" ? t("guide.startTour") : t("guide.pageTour", { page: t(`mode.${page}`) })}
                    </button>
                  ))}
                  <div className="my-1 border-t-cp" role="separator" />
                  {(["bug", "feature"] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      title={t("feedback.help")}
                      onClick={() => {
                        setGuideOpen(false);
                        openLink(kind);
                      }}
                      className="rounded-cp-sm px-3 py-2 text-left text-cp-text hover:bg-cp-surface-hi"
                    >
                      {t(`feedback.${kind}`)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAboutOpen(true)}
                    className="rounded-cp-sm px-3 py-2 text-left text-cp-muted hover:bg-cp-surface-hi hover:text-cp-text"
                  >
                    {t("about.open")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <DisplayLink />
      </div>
    </header>
  );
}
