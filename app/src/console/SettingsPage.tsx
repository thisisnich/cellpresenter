import { useEffect, useState } from "react";
import { appIconSvg } from "../brand/appIcon";
import { Mark } from "../brand/Mark";
import { LayoutEditor } from "./LayoutEditor";
import { t } from "../i18n";
import {
  allPalettes,
  COLOR_GROUPS,
  deletePalette,
  isBuiltIn,
  resolveTheme,
  saveAsPalette,
  setColorPrefs,
  updateSavedPalette,
  useColorPrefs,
  useTheme,
  type ColorName,
} from "../theme/palettes";
import { themeCssVars } from "../theme/tokens";

const HEX = /^#[0-9a-f]{6}$/i;

/** A hex box that lets you type freely and only takes a whole colour. */
function HexInput({ id, value, onChange }: { id: string; value: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      id={id}
      value={draft}
      spellCheck={false}
      maxLength={7}
      onChange={(e) => {
        const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
        setDraft(v);
        if (HEX.test(v)) onChange(v.toUpperCase());
      }}
      onBlur={() => setDraft(value)}
      className="w-[76px] rounded-cp-sm border-cp bg-cp-surface px-1.5 py-1 font-mono text-[12px] text-cp-text uppercase"
    />
  );
}

/** How the chosen colours look: a bit of the console and the app icon. */
function Preview() {
  const theme = useTheme();
  const icon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(appIconSvg(theme.colors))}`;
  const ring = (color: string) => ({ boxShadow: `0 0 0 var(--cp-highlight-width) ${color}` });
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-cp border-cp bg-cp-bg" aria-hidden="true">
        <div className="flex items-center gap-2 border-b-cp bg-cp-chrome px-3 py-2">
          <Mark size={16} />
          <span className="text-[12px] font-bold">{t("app.name")}</span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-cp-muted">
            <span className="size-[6px] rounded-full bg-cp-ok" />
            {t("connection.open")}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 bg-cp-panel p-3">
          {(
            [
              ["var(--cp-live)", "sectionVerse", t("settings.preview.live")],
              ["var(--cp-next)", "sectionChorus", t("settings.preview.next")],
            ] as const
          ).map(([color, section, label]) => (
            <div key={section} className="overflow-hidden rounded-cp-sm bg-cp-chrome" style={ring(color)}>
              <div className="cp-checker flex aspect-video items-center justify-center p-2 text-center text-[9px] font-semibold text-white">
                {t("settings.preview.lyric")}
              </div>
              <div className="px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: `var(--cp-${section === "sectionVerse" ? "section-verse" : "section-chorus"})` }}>
                {label}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t-cp bg-cp-chrome px-3 py-2">
          <span className="text-[11px] text-cp-muted">{t("settings.preview.muted")}</span>
          <span className="cp-btn ml-auto px-2.5 py-0.5 text-[12px]">{t("transport.prev")}</span>
          <span className="cp-btn-live px-2.5 py-0.5 text-[12px]">{t("transport.next")}</span>
        </div>
      </div>
      <div className="flex items-end gap-3">
        {[72, 36, 18].map((s) => (
          <img key={s} src={icon} width={s} height={s} alt={s === 72 ? t("settings.preview.icon") : ""} />
        ))}
        <p className="m-0 text-[11px] text-cp-muted">{t("settings.preview.iconHelp")}</p>
      </div>
    </div>
  );
}

export type SettingsSection = "colours" | "screen";
const SECTIONS: SettingsSection[] = ["colours", "screen"];
const OPEN_EVENT = "cellpresenter:settings";

/** Open the Settings page at a section, from anywhere in the console. */
export function openSettings(section: SettingsSection) {
  window.dispatchEvent(new CustomEvent<SettingsSection>(OPEN_EVENT, { detail: section }));
}

/** Calls `open` when something asks for the Settings page. */
export function onOpenSettings(open: (section: SettingsSection) => void): () => void {
  const listener = (e: Event) => open((e as CustomEvent<SettingsSection>).detail);
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}

/** The Settings page: colours (this device's palettes, and every colour of
 *  the console, the logo and the app icon) and the screen layout (where the
 *  words and copyright line go on every display, and the title slide). */
export function SettingsPage({
  section,
  onSection,
  onClose,
}: {
  section: SettingsSection;
  onSection: (section: SettingsSection) => void;
  onClose: () => void;
}) {
  const prefs = useColorPrefs();
  const theme = useTheme();
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const changed = Object.keys(prefs.custom).length;
  const builtIn = isBuiltIn(prefs.palette);

  const setColor = (name: ColorName, hex: string) => setColorPrefs({ ...prefs, custom: { ...prefs.custom, [name]: hex } });
  const resetColor = (name: ColorName) => {
    const { [name]: _, ...rest } = prefs.custom;
    setColorPrefs({ ...prefs, custom: rest });
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-cp-bg font-ui text-[13px] text-cp-text">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="m-0 text-lg font-semibold">{t("settings.title")}</h1>
            <p className="m-0 mt-0.5 text-cp-muted">{t(`settings.${section}.intro`)}</p>
          </div>
          <div className="mr-auto ml-4 flex rounded-cp border-cp bg-cp-panel p-0.5" role="tablist" aria-label={t("settings.title")}>
            {SECTIONS.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={section === s}
                onClick={() => onSection(s)}
                className={`rounded-cp-sm px-3.5 py-1 ${section === s ? "bg-cp-surface-hi font-semibold" : "text-cp-muted hover:bg-cp-hover hover:text-cp-text"}`}
              >
                {t(`settings.section.${s}`)}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} className="cp-btn px-4 py-1.5">
            {t("settings.done")}
          </button>
        </div>

        {section === "screen" ? (
          <LayoutEditor />
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
            <div className="flex flex-col gap-5 lg:sticky lg:top-0">
              <Preview />
              <section className="flex flex-col gap-2">
                <h2 className="m-0 text-[12px] font-semibold tracking-wide text-cp-muted uppercase">{t("settings.palettes")}</h2>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("settings.palettes")}>
                  {allPalettes(prefs).map((p) => {
                    const on = prefs.palette === p.name;
                    const look = resolveTheme({ ...prefs, palette: p.name, custom: {} });
                    return (
                      <div key={p.name} className="relative">
                        <button
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => setColorPrefs({ ...prefs, palette: p.name, custom: {} })}
                          style={themeCssVars(look)}
                          className={`flex w-full items-center gap-2 rounded-cp border-cp bg-cp-chrome px-2.5 py-2 text-left text-cp-text ${on ? "outline-2 outline-offset-1 outline-cp-live" : ""}`}
                        >
                          <Mark size={18} />
                          <span className="min-w-0 flex-1 truncate text-[12px]">{p.name}</span>
                          <span className="flex gap-0.5">
                            <span className="size-2.5 rounded-full bg-cp-live" />
                            <span className="size-2.5 rounded-full bg-cp-next" />
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
                {!builtIn && (
                  <div className="flex items-center gap-2">
                    {deleting === prefs.palette ? (
                      <>
                        <span className="text-[12px] text-cp-muted">{t("settings.deleteSure", { name: prefs.palette })}</span>
                        <button type="button" onClick={() => (setColorPrefs(deletePalette(prefs, prefs.palette)), setDeleting(null))} className="cp-btn-danger px-2.5 py-1 text-[12px]">
                          {t("settings.delete")}
                        </button>
                        <button type="button" onClick={() => setDeleting(null)} className="cp-btn px-2.5 py-1 text-[12px]">
                          {t("settings.keep")}
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setDeleting(prefs.palette)} className="cp-btn px-2.5 py-1 text-[12px]">
                        {t("settings.deletePalette", { name: prefs.palette })}
                      </button>
                    )}
                  </div>
                )}
              </section>
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              <div className="flex flex-wrap items-center gap-2 rounded-cp border-cp bg-cp-panel px-3 py-2.5">
                <span className="mr-auto text-[12px] text-cp-muted">
                  {changed ? t("settings.changed", { count: changed, name: prefs.palette }) : t("settings.unchanged", { name: prefs.palette })}
                </span>
                {changed > 0 && !builtIn && (
                  <button type="button" onClick={() => setColorPrefs(updateSavedPalette(prefs))} className="cp-btn-live px-3 py-1 text-[12px]">
                    {t("settings.saveTo", { name: prefs.palette })}
                  </button>
                )}
                <form
                  className="flex items-center gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setColorPrefs(saveAsPalette(prefs, newName));
                    setNewName("");
                  }}
                >
                  <label className="sr-only" htmlFor="palette-name">
                    {t("settings.newName")}
                  </label>
                  <input
                    id="palette-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t("settings.newName")}
                    className="w-40 rounded-cp-sm border-cp bg-cp-surface px-2 py-1 text-[12px] text-cp-text"
                  />
                  <button type="submit" className="cp-btn px-3 py-1 text-[12px]">
                    {t("settings.saveNew")}
                  </button>
                </form>
                {changed > 0 && (
                  <button type="button" onClick={() => setColorPrefs({ ...prefs, custom: {} })} className="cp-btn px-3 py-1 text-[12px]">
                    {t("settings.discard")}
                  </button>
                )}
              </div>

              {COLOR_GROUPS.map((group) => (
                <section key={group.id} className="flex flex-col gap-2">
                  <div>
                    <h2 className="m-0 text-[12px] font-semibold tracking-wide text-cp-muted uppercase">{t(`settings.group.${group.id}`)}</h2>
                    <p className="m-0 text-[12px] text-cp-muted">{t(`settings.group.${group.id}Help`)}</p>
                  </div>
                  <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    {group.colors.map((name) => {
                      const id = `color-${name}`;
                      const value = theme.colors[name];
                      const own = prefs.custom[name] !== undefined;
                      return (
                        <div key={name} className="flex items-center gap-2.5">
                          <input
                            type="color"
                            id={id}
                            value={value}
                            onChange={(e) => setColor(name, e.target.value.toUpperCase())}
                            className="h-8 w-10 shrink-0 cursor-pointer rounded-cp-sm border-cp bg-cp-surface p-0.5"
                          />
                          <label htmlFor={id} className="min-w-0 flex-1">
                            <span className="block text-[13px]">
                              {t(`settings.color.${name}`)}
                              {own && <span className="ml-1.5 text-[11px] text-cp-live">{t("settings.edited")}</span>}
                            </span>
                            <span className="block text-[11px] text-cp-muted">{t(`settings.color.${name}Help`)}</span>
                          </label>
                          <HexInput id={`${id}-hex`} value={value} onChange={(hex) => setColor(name, hex)} />
                          <button
                            type="button"
                            onClick={() => resetColor(name)}
                            disabled={!own}
                            title={t("settings.resetHelp")}
                            className="w-12 rounded-cp-sm px-1 py-0.5 text-[11px] text-cp-muted enabled:hover:bg-cp-hover hover:text-cp-text disabled:invisible"
                          >
                            {t("settings.reset")}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
