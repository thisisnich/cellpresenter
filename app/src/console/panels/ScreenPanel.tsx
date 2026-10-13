import { useEffect, useState } from "react";
import type { FooterMode } from "../../generated/FooterMode";
import type { Look } from "../../generated/Look";
import { t } from "../../i18n";
import { api, ApiError } from "../../lib/api";
import { useLive } from "../LiveContext";

const FOOTER_MODES: FooterMode[] = ["first", "all", "off"];

// How every screen looks, set once for the church: for now the copyright
// line under songs (CCLI). Changes reach every display straight away.
export function ScreenPanel() {
  const { state } = useLive();
  const look = state?.look;
  const [licence, setLicence] = useState(look?.ccli_licence ?? "");
  const [error, setError] = useState<string | null>(null);

  // Follow changes made elsewhere (another console, a restart).
  useEffect(() => setLicence(look?.ccli_licence ?? ""), [look?.ccli_licence]);

  if (!look) return null;

  const save = async (next: Look) => {
    setError(null);
    try {
      await api.setLook(next);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "pin_required"
          ? t("screen.needPin")
          : err instanceof ApiError && err.code === "licence_too_long"
            ? t("screen.licenceTooLong")
            : t("screen.saveFailed"),
      );
    }
  };
  const saveLicence = () => {
    const value = licence.trim() || null;
    if (value !== (look.ccli_licence ?? null)) void save({ ...look, ccli_licence: value });
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-cp-panel p-3.5 font-ui text-[13px] text-cp-text">
      <section className="flex flex-col gap-2" aria-labelledby="screen-footer">
        <h3 id="screen-footer" className="cp-label m-0">
          {t("screen.footer")}
        </h3>
        <div className="flex self-start rounded-cp border-cp bg-cp-bg p-0.5" role="group" aria-labelledby="screen-footer">
          {FOOTER_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => void save({ ...look, footer: mode })}
              aria-pressed={look.footer === mode}
              className={`rounded-cp-sm px-2.5 py-1 ${look.footer === mode ? "bg-cp-surface-hi font-semibold" : "text-cp-muted hover:text-cp-text"}`}
            >
              {t(`screen.footer.${mode}`)}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-cp-muted">{t("screen.licence")}</span>
          <input
            value={licence}
            inputMode="numeric"
            onChange={(e) => setLicence(e.target.value)}
            onBlur={saveLicence}
            onKeyDown={(e) => e.key === "Enter" && saveLicence()}
            className="w-40 rounded-cp border-cp bg-cp-bg px-2.5 py-1.5 font-mono"
          />
        </label>
        <p className="m-0 text-[12px] text-cp-muted">{t("screen.footerHint")}</p>
        {error && (
          <p role="alert" className="m-0 text-cp-danger">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
