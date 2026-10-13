import type { Media } from "../generated/Media";

// A picture's thumbnail, or a still frame of a video, filling its box.
export function MediaThumb({ media, alt = "" }: { media: Media; alt?: string }) {
  return media.video ? (
    <video
      src={`${media.url}#t=0.5`}
      muted
      playsInline
      preload="metadata"
      aria-label={alt || undefined}
      className="absolute inset-0 h-full w-full object-cover"
    />
  ) : (
    <img src={media.thumb_url} alt={alt} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
  );
}
