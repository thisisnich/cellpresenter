import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface Aspect {
  label: string;
  w: number;
  h: number;
}

export const ASPECT_OPTIONS: Aspect[] = [
  { label: "16:9", w: 16, h: 9 },
  { label: "16:10", w: 16, h: 10 },
  { label: "4:3", w: 4, h: 3 },
  { label: "21:9", w: 21, h: 9 },
  { label: "9:16", w: 9, h: 16 },
];

// Fits a fixed-aspect frame into the available area, centered with black bars —
// exactly how a physical display of that shape letterboxes the 1920x1080 stage.
// Choosing the target aspect makes the console preview WYSIWYG per device.
export function PreviewFrame({
  aspect,
  children,
}: {
  aspect: Aspect;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      let w = r.width;
      let h = (w * aspect.h) / aspect.w;
      if (h > r.height) {
        h = r.height;
        w = (h * aspect.w) / aspect.h;
      }
      setBox({ w, h });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  return (
    <div ref={ref} className="absolute inset-4 flex items-center justify-center">
      <div
        className="relative shrink-0 overflow-hidden rounded-lg bg-black ring-1 ring-slate-800"
        style={{ width: box.w, height: box.h }}
      >
        {children}
      </div>
    </div>
  );
}
