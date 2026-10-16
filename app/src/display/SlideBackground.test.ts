import { describe, expect, it } from "vitest";
import { faded, loaded, picked, playersFor, savedStillUrl, type Swap } from "./SlideBackground";

const hash = "4497cafa252cd03821fbddef16ea3d25109612dc25a86cfcef2c62460bf51857";

describe("savedStillUrl", () => {
  it("points a stored video at its still, keeping the version", () => {
    expect(savedStillUrl(`/media/${hash}.mp4?v=35757666`)).toBe(`/media/thumbs/${hash}.jpg?v=35757666`);
    expect(savedStillUrl(`http://192.168.1.4:7420/media/${hash}.webm#t=0.5`)).toBe(
      `http://192.168.1.4:7420/media/thumbs/${hash}.jpg`,
    );
  });

  it("leaves other URLs to the frame grab", () => {
    expect(savedStillUrl("https://example.com/clip.mp4")).toBeNull();
    expect(savedStillUrl(`/media/${hash}.jpg`)).toBeNull();
  });
});

describe("background swaps", () => {
  const start: Swap = { shown: "a.mp4", pending: null, leaving: null };

  it("keeps the old background on screen while the next one loads, then fades it out", () => {
    const next = picked(start, "b.mp4");
    expect(next).toEqual({ shown: "a.mp4", pending: "b.mp4", leaving: null });
    const on = loaded(next, "b.mp4");
    expect(on).toEqual({ shown: "b.mp4", pending: null, leaving: "a.mp4" });
    expect(faded(on, "a.mp4")).toEqual({ shown: "b.mp4", pending: null, leaving: null });
  });

  it("drops a background still loading when another is picked", () => {
    const twice = picked(picked(start, "b.mp4"), "c.mp4");
    expect(twice.pending).toBe("c.mp4");
    expect(loaded(twice, "b.mp4")).toBe(twice);
  });

  it("going back to what's on screen just stops loading", () => {
    expect(picked(picked(start, "b.mp4"), "a.mp4")).toEqual(start);
  });

  it("keeps players for what's coming up, a few at most", () => {
    expect(playersFor(start, ["b.mp4", "a.mp4", "b.mp4", "c.mp4", "d.mp4", "e.mp4"])).toEqual(["a.mp4", "b.mp4", "c.mp4", "d.mp4"]);
  });
});
