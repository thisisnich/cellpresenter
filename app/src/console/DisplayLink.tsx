import qrcode from "qrcode-generator";
import { useEffect, useMemo, useRef, useState } from "react";
import type { NetworkAddress } from "../generated/NetworkAddress";
import type { NetworkInfo } from "../generated/NetworkInfo";
import { t } from "../i18n";
import { api } from "../lib/api";
import { ROUTES } from "../lib/routes";

type Target = "display" | "remote" | "chords";

function linkUrl(address: NetworkAddress, port: number, target: Target, pin: string | null): string {
  const base = `http://${address.ip}:${port}`;
  // The remote link carries the PIN after #, which browsers never send to
  // the server: scanning it pairs the phone without typing the PIN.
  if (target === "display") return `${base}${ROUTES.display}`;
  if (target === "chords") return `${base}${ROUTES.chords}`;
  return `${base}${ROUTES.remote}${pin ? `#pin=${pin}` : ""}`;
}

/** A QR code drawn as SVG squares, so it scales crisply and follows no theme. */
function QrCode({ text, size = 176 }: { text: string; size?: number }) {
  const cells = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const dark: [number, number][] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) dark.push([r, c]);
    return { n, dark };
  }, [text]);
  const quiet = 2;
  const span = cells.n + quiet * 2;
  return (
    <svg
      role="img"
      aria-label={t("displayLink.qrLabel", { url: text })}
      viewBox={`0 0 ${span} ${span}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="rounded-cp-sm"
    >
      <rect width={span} height={span} fill="#ffffff" />
      {cells.dark.map(([r, c]) => (
        <rect key={`${r}-${c}`} x={c + quiet} y={r + quiet} width={1} height={1} fill="#000000" />
      ))}
    </svg>
  );
}

// "Display link" button with a popover: this computer's addresses as links
// and a QR code, so a phone or TV browser can open the display.
export function DisplayLink() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<NetworkInfo | null>(null);
  const [chosen, setChosen] = useState(0);
  const [target, setTarget] = useState<Target>("display");
  const [pin, setPin] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    api
      .pin()
      .then((p) => setPin(p.pin))
      .catch(() => setPin(null));
    api
      .network()
      .then(setInfo)
      .catch(() => setInfo({ port: 0, addresses: [] }));
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const addresses = info?.addresses ?? [];
  const current = addresses[Math.min(chosen, addresses.length - 1)];
  const url = current && info ? linkUrl(current, info.port, target, pin) : null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked; the address is on screen and selectable.
    }
  };

  return (
    <div ref={root} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="cp-btn">
        {t("displayLink.button")}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t("displayLink.title")}
          className="absolute top-full right-0 z-50 mt-2 flex w-[340px] flex-col gap-3 rounded-cp border-cp bg-cp-chrome p-4 text-cp-text shadow-2xl"
        >
          <div>
            <h2 className="m-0 text-sm font-semibold">{t("displayLink.title")}</h2>
            <p className="m-0 mt-1 text-cp-muted">{target === "remote" ? t("displayLink.howToRemote") : target === "chords" ? t("displayLink.howToChords") : t("displayLink.howTo")}</p>
          </div>

          <div className="flex rounded-cp border-cp bg-cp-bg p-0.5" role="tablist">
            {(["display", "chords", "remote"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={target === k}
                onClick={() => setTarget(k)}
                className={`flex-1 rounded-cp-sm px-3 py-1 ${target === k ? "bg-cp-surface-hi font-semibold" : "text-cp-muted"}`}
              >
                {k === "display" ? t("displayLink.display") : k === "chords" ? t("displayLink.chords") : t("displayLink.remote")}
              </button>
            ))}
          </div>

          {!info && <p className="m-0 text-cp-muted">{t("connection.connecting")}</p>}
          {info && addresses.length === 0 && <p className="m-0 text-cp-danger">{t("displayLink.noNetwork")}</p>}

          {url && (
            <>
              <div className="flex justify-center">
                <QrCode text={url} />
              </div>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-cp-sm border-cp bg-cp-bg px-2 py-1.5 font-mono text-[12px] select-all">
                  {url}
                </code>
                <button type="button" onClick={copy} className="cp-btn px-2.5 py-1.5">
                  {copied ? t("header.copied") : t("displayLink.copy")}
                </button>
              </div>
            </>
          )}

          {addresses.length > 1 && (
            <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
              <legend className="cp-label mb-1">{t("displayLink.network")}</legend>
              {addresses.map((a, i) => (
                <label key={a.ip} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="display-address"
                    checked={i === chosen}
                    onChange={() => setChosen(i)}
                    className="accent-[var(--cp-live)]"
                  />
                  <span>{a.kind === "tailscale" ? t("displayLink.tailscale") : t("displayLink.lan")}</span>
                  <span className="font-mono text-[12px] text-cp-muted">
                    {a.ip} · {a.interface}
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          <p className="m-0 text-[12px] text-cp-muted">
            {current?.kind === "tailscale" ? t("displayLink.tipTailscale") : t("displayLink.tipLan")}
          </p>
          {import.meta.env.DEV && <p className="m-0 text-[12px] text-cp-live">{t("displayLink.devNote")}</p>}
        </div>
      )}
    </div>
  );
}
