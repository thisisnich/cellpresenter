import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

// The stage is a fixed-resolution virtual canvas. Every display (projector,
// TV, phone) lays lyrics out in this same 1920x1080 space and scales the whole
// thing uniformly to fit — so line breaks, wrapping, and proportions are
// identical on every screen. The backdrop (a background picture) fills the
// whole screen instead, cropped to fit, so a screen that isn't 16:9 shows no
// bars around it.
export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

export function Stage({ children, backdrop, clear = false }: { children: ReactNode; backdrop?: ReactNode; clear?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setScale(Math.min(r.width / STAGE_WIDTH, r.height / STAGE_HEIGHT));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // shrink-0 matters: as a flex child the 1920px canvas would otherwise shrink
  // to its container's width, so each screen would wrap lyrics differently.
  return (
    <div
      ref={ref}
      className={`absolute inset-0 flex items-center justify-center overflow-hidden ${clear ? "" : "bg-black"}`}
    >
      {backdrop}
      <div
        className="relative flex shrink-0 items-center justify-center"
        style={{
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
