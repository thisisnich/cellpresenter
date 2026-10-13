import { useRef, useState } from "react";
import { t } from "../../i18n";
import { api, ApiError } from "../../lib/api";
import { useConsole } from "../ConsoleContext";
import { MEDIA_DRAG_TYPE } from "../dragMedia";
import { useLive } from "../LiveContext";
import { MediaThumb } from "../MediaThumb";

const isVideoFile = (f: File) => /^video\//.test(f.type) || /\.(mp4|m4v|webm|mov)$/i.test(f.name);

/** A video's size, read by the browser before upload (null if it can't). */
function videoSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (size: { width: number; height: number } | null) => {
      URL.revokeObjectURL(url);
      resolve(size);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => done(video.videoWidth ? { width: video.videoWidth, height: video.videoHeight } : null);
    video.onerror = () => done(null);
    window.setTimeout(() => done(null), 5000);
    video.src = url;
  });
}

// Background pictures and videos. Click one to put it on screen now (it stays across
// slides and songs, like ProPresenter's background layer); drag one onto a
// slide to cue it there. Upload with the button or by dropping files here.
export function MediaPanel() {
  const { state, setBackground } = useLive();
  const { media, reloadMedia } = useConsole();
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | File[]) => {
    const usable = [...files].filter((f) => f.type.startsWith("image/") || isVideoFile(f));
    if (usable.length === 0) {
      setError(t("media.notImages"));
      return;
    }
    setError(null);
    setUploading((n) => n + usable.length);
    for (const file of usable) {
      try {
        if (isVideoFile(file)) await api.uploadVideo(file, await videoSize(file));
        else await api.uploadMedia(file);
      } catch (err) {
        const code = err instanceof ApiError ? err.code : "";
        setError(
          code === "too_large"
            ? t(isVideoFile(file) ? "media.videoTooLarge" : "media.tooLarge", { name: file.name })
            : code === "not_an_image" || code === "not_a_video"
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
        if (!e.dataTransfer.types.includes("Files")) return;
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
          accept="image/*,video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov"
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
          const onScreen = state?.background === m.url;
          return (
            <figure
              key={m.id}
              className="m-0 flex flex-col overflow-hidden rounded-cp bg-cp-chrome"
              style={{ border: onScreen ? "var(--cp-highlight-width) solid var(--cp-live)" : "var(--cp-border-width) solid var(--cp-line)" }}
            >
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(MEDIA_DRAG_TYPE, m.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => void setBackground(onScreen ? null : m.id)}
                aria-pressed={onScreen}
                title={onScreen ? t("media.takeOff") : t("media.show")}
                className="relative aspect-video cursor-pointer border-0 bg-black p-0"
              >
                <MediaThumb media={m} alt={m.name} />
                {m.video && (
                  <span className="absolute right-1.5 bottom-1.5 rounded-cp-sm bg-black/70 px-1 text-[10px] font-semibold text-white">{t("media.video")}</span>
                )}
                {onScreen && (
                  <span className="absolute top-1 left-1 rounded-cp-sm bg-cp-live px-1.5 py-0.5 text-[10px] font-bold text-cp-on-live">
                    {t("media.onScreen")}
                  </span>
                )}
              </button>
              <figcaption className="flex items-center gap-1 p-1.5">
                {confirmRemove === m.id ? (
                  <>
                    <button type="button" onClick={() => void remove(m.id)} className="cp-btn-danger flex-1 px-1.5 py-1 text-[11px]">
                      {t("media.remove")}
                    </button>
                    <button type="button" onClick={() => setConfirmRemove(null)} className="cp-btn flex-1 px-1.5 py-1 text-[11px]">
                      {t("editor.keep")}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-[12px]" title={m.name}>
                      {m.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(m.id)}
                      aria-label={t("media.removeNamed", { name: m.name })}
                      className="rounded-cp-sm px-1.5 py-0.5 text-[11px] text-cp-muted hover:text-cp-danger"
                    >
                      ✕
                    </button>
                  </>
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
