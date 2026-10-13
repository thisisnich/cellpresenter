import type { Media } from "../generated/Media";
import { VideoStill } from "../display/SlideBackground";

// A picture's thumbnail, or a still frame of a video, filling its box.
export function MediaThumb({ media, alt = "" }: { media: Media; alt?: string }) {
  return media.video ? (
    <VideoStill url={media.url} label={alt || undefined} />
  ) : (
    <img src={media.thumb_url} alt={alt} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
  );
}
