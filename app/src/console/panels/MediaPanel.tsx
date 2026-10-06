import { useRef, useState } from "react";
import { t } from "../../i18n";
import { api, ApiError } from "../../lib/api";
import { useConsole } from "../ConsoleContext";

// Background images: upload (button or drag-and-drop), pick the default
// background, remove. Songs and announcements choose theirs in their editors.
export function MediaPanel() {
  const { media, reloadMedia, defaultBackgroundId, setDefaultBackground } = useConsole();
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | File[]) => {
    const images = [...files].filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      setError(t("media.notImages"));
      return;
    }
    setError(null);
    setUploading((n) => n + images.length);
    for (const file of images) {
      try {
        await api.uploadMedia(file);
      } catch (err) {
        const code = err instanceof ApiError ? err.code : "";
        setError(
          code === "too_large"
            ? t("media.tooLarge", { name: file.name })
            : code === "not_an_image"
              ? t("media.notAnImage", { name: file.name })
              : t("media.uploadFailed", { name: file.name }),
        );
      } finally {
        setUploading((n) => n - 1);
      }
    }
    await reloadMedia();
  };

  const remove = async (id: string) => {
    try {
      await api.deleteMedia(id);
      setConfirmRemove(null);
      await reloadMedia();
    } catch {
      setError(t("media.removeFailed"));
    }
  };

  const toggleDefault = async (id: string) => {
    try {
      await setDefaultBackground(defaultBackgroundId === id ? null : id);
    } catch {
      setError(t("media.defaultFailed"));
    }
  };

  return (
    <div
      className="relative flex h-full flex-col bg-cp-panel font-ui text-[13px] text-cp-text"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void upload(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-col gap-2 border-b-cp p-3">
        <button type="button" onClick={() => input.current?.click()} className="cp-btn w-full">
          {uploading > 0 ? t("media.uploading", { count: uploading }) : t("media.upload")}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="m-0 text-[12px] text-cp-muted">{t("media.hint")}</p>
        {error && (
          <p role="alert" className="m-0 text-cp-danger">
            {error}
          </p>
        )}
      </div>

      <div className="grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5 overflow-y-auto p-3">
        {media.length === 0 && <p className="col-span-full m-0 text-cp-muted">{t("media.empty")}</p>}
        {media.map((m) => {
          const isDefault = m.id === defaultBackgroundId;
          return (
            <figure key={m.id} className="m-0 flex flex-col overflow-hidden rounded-cp border-cp bg-cp-chrome">
              <div className="relative aspect-video bg-black">
                <img src={m.thumb_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                {isDefault && (
                  <span className="absolute top-1 left-1 rounded-cp-sm bg-cp-live px-1.5 py-0.5 text-[10px] font-bold text-cp-on-live">
                    {t("media.defaultBadge")}
                  </span>
                )}
              </div>
              <figcaption className="flex flex-col gap-1 p-1.5">
                <span className="truncate text-[12px]" title={m.name}>
                  {m.name}
                </span>
                {confirmRemove === m.id ? (
                  <span className="flex gap-1">
                    <button type="button" onClick={() => void remove(m.id)} className="cp-btn-danger flex-1 px-1.5 py-1 text-[11px]">
                      {t("media.remove")}
                    </button>
                    <button type="button" onClick={() => setConfirmRemove(null)} className="cp-btn flex-1 px-1.5 py-1 text-[11px]">
                      {t("editor.keep")}
                    </button>
                  </span>
                ) : (
                  <span className="flex gap-1">
                    <button type="button" onClick={() => void toggleDefault(m.id)} className="cp-btn flex-1 px-1.5 py-1 text-[11px]">
                      {isDefault ? t("media.unsetDefault") : t("media.setDefault")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(m.id)}
                      aria-label={t("media.removeNamed", { name: m.name })}
                      className="cp-btn px-2 py-1 text-[11px] hover:text-cp-danger"
                    >
                      ✕
                    </button>
                  </span>
                )}
              </figcaption>
            </figure>
          );
        })}
      </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-cp border-2 border-dashed border-cp-live bg-cp-bg/80 text-cp-live">
          {t("media.drop")}
        </div>
      )}
    </div>
  );
}
