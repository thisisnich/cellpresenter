import { useState } from "react";
import { t } from "../i18n";
import { api, ApiError, setControlPin } from "../lib/api";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

// Ask for the 4-digit PIN shown in the console header. Checked against the
// server before the remote opens.
export function PinGate({ onPaired, reason }: { onPaired: () => void; reason?: "changed" }) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState<string | null>(reason === "changed" ? t("remote.pinChanged") : null);
  const [checking, setChecking] = useState(false);

  const press = async (key: string) => {
    if (checking) return;
    if (key === "⌫") {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    const next = (digits + key).slice(0, 4);
    setDigits(next);
    if (next.length < 4) return;
    setChecking(true);
    setControlPin(next);
    try {
      await api.checkControl();
      onPaired();
    } catch (err) {
      setControlPin(null);
      setDigits("");
      setError(err instanceof ApiError && err.status === 429 ? t("remote.tooManyTries") : t("remote.wrongPin"));
    } finally {
      setChecking(false);
    }
  };

  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-6 bg-cp-bg p-6 font-ui text-cp-text">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="m-0 text-xl font-semibold">{t("remote.pinTitle")}</h1>
        <p className="m-0 max-w-[30ch] text-cp-muted">{t("remote.pinHelp")}</p>
      </div>
      <div className="flex gap-3" aria-label={t("remote.pinEntered", { count: digits.length })}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`size-4 rounded-full ${i < digits.length ? "bg-cp-live" : "border-cp"}`} />
        ))}
      </div>
      {error && (
        <p role="alert" className="m-0 text-center text-cp-danger">
          {error}
        </p>
      )}
      <div className="grid w-full max-w-72 grid-cols-3 gap-3">
        {KEYS.map((key, i) =>
          key ? (
            <button
              key={i}
              type="button"
              onClick={() => void press(key)}
              aria-label={key === "⌫" ? t("remote.delete") : key}
              className="h-16 rounded-cp border-cp bg-cp-surface font-mono text-2xl active:bg-cp-surface-hi"
            >
              {key}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
    </main>
  );
}
