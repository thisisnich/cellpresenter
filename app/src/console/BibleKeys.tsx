import { useEffect, useMemo, useState } from "react";
import type { BibleSources } from "../generated/BibleSources";
import type { OnlineBible } from "../generated/OnlineBible";
import { t } from "../i18n";
import { api, ApiError } from "../lib/api";

const MAX_CHOSEN = 12;

function problem(err: unknown): string {
  const code = err instanceof ApiError ? err.code : "";
  if (code === "bad_key") return t("bibleKeys.badKey");
  if (code === "pin_required") return t("bibleKeys.needPin");
  if (code === "unavailable") return t("bibleKeys.offline");
  return t("bibleKeys.failed");
}

function KeyRow({
  label,
  where,
  hint,
  onSave,
}: {
  label: string;
  where: string;
  hint: string | null;
  onSave: (key: string | null) => Promise<void>;
}) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (value: string | null) => {
    setBusy(true);
    setError(null);
    try {
      await onSave(value);
      setKey("");
    } catch (err) {
      setError(problem(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{label}</span>
        <span className="text-[12px] text-cp-muted select-text">{where}</span>
      </div>
      {hint ? (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-cp-muted">{t("bibleKeys.saved", { hint })}</span>
          <button type="button" disabled={busy} onClick={() => void save(null)} className="text-[12px] text-cp-muted underline hover:text-cp-text">
            {t("bibleKeys.remove")}
          </button>
        </div>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim()) void save(key.trim());
          }}
        >
          <input
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={t("bibleKeys.paste")}
            aria-label={t("bibleKeys.keyFor", { label })}
            className="min-w-0 flex-1 rounded-cp border-cp bg-cp-bg px-2 py-1 font-mono text-[12px]"
          />
          <button type="submit" disabled={busy || !key.trim()} className="cp-btn px-2.5 py-1">
            {busy ? t("bibleKeys.checking") : t("bibleKeys.save")}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="m-0 text-[12px] text-cp-danger">
          {error}
        </p>
      )}
    </div>
  );
}

// The church's own keys for copyrighted Bibles (ESV, NIV, NASB…): the
// services' free, non-commercial keys. Keys stay on this computer.
export function BibleKeys({ onChange }: { onChange: () => void }) {
  const [sources, setSources] = useState<BibleSources | null>(null);
  const [available, setAvailable] = useState<OnlineBible[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .bibleSources()
      .then((s) => {
        setSources(s);
        setChosen(new Set(s.api_bibles.map((b) => b.id)));
        if (s.api_bible) api.apiBiblesAvailable().then(setAvailable).catch((err) => setError(problem(err)));
      })
      .catch((err) => setError(problem(err)));
  }, []);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (available ?? []).filter((b) => !q || `${b.abbreviation} ${b.name}`.toLowerCase().includes(q));
  }, [available, filter]);

  const saveChoice = async (next: Set<string>) => {
    setChosen(next);
    setError(null);
    try {
      setSources(await api.chooseApiBibles((available ?? []).filter((b) => next.has(b.id))));
      onChange();
    } catch (err) {
      setError(problem(err));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[12px] text-cp-muted">{t("bibleKeys.intro")}</p>
      <KeyRow
        label="ESV"
        where="api.esv.org"
        hint={sources?.esv ?? null}
        onSave={async (key) => {
          setSources(await api.setEsvKey(key));
          onChange();
        }}
      />
      <KeyRow
        label={t("bibleKeys.apiBible")}
        where="api.bible"
        hint={sources?.api_bible ?? null}
        onSave={async (key) => {
          const setup = await api.setApiBibleKey(key);
          setSources(setup.sources);
          setAvailable(key ? setup.available : null);
          setChosen(new Set(setup.sources.api_bibles.map((b) => b.id)));
          onChange();
        }}
      />
      {sources?.api_bible && available && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] text-cp-muted">{t("bibleKeys.choose", { count: chosen.size, max: MAX_CHOSEN })}</span>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("bibleKeys.filter")}
            className="rounded-cp border-cp bg-cp-bg px-2 py-1 text-[12px]"
          />
          <ul className="m-0 flex max-h-48 list-none flex-col overflow-y-auto rounded-cp border-cp p-1">
            {shown.length === 0 && <li className="p-1 text-[12px] text-cp-muted">{t("bibleKeys.noneAvailable")}</li>}
            {shown.map((b) => (
              <li key={b.id}>
                <label className="flex items-center gap-2 rounded-cp px-1.5 py-1 hover:bg-cp-surface">
                  <input
                    type="checkbox"
                    checked={chosen.has(b.id)}
                    disabled={!chosen.has(b.id) && chosen.size >= MAX_CHOSEN}
                    onChange={(e) => {
                      const next = new Set(chosen);
                      if (e.target.checked) next.add(b.id);
                      else next.delete(b.id);
                      void saveChoice(next);
                    }}
                  />
                  <span className="font-semibold">{b.abbreviation}</span>
                  <span className="truncate text-[12px] text-cp-muted">{b.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p role="alert" className="m-0 text-[12px] text-cp-danger">
          {error}
        </p>
      )}
    </div>
  );
}
