import { describe, expect, it } from "vitest";
import { onceReady, savedStillUrl, withNext } from "./SlideBackground";

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

describe("background layers", () => {
  const shown = [{ id: 0, url: "a.mp4", ready: true }];

  it("keeps the old background on screen while the next one loads", () => {
    const next = withNext(shown, "b.mp4", 1);
    expect(next).toEqual([...shown, { id: 1, url: "b.mp4", ready: false }]);
    expect(onceReady(next, 1)).toEqual([{ id: 1, url: "b.mp4", ready: true }]);
  });

  it("drops a background still loading when another is picked", () => {
    const twice = withNext(withNext(shown, "b.mp4", 1), "c.mp4", 2);
    expect(twice.map((l) => l.url)).toEqual(["a.mp4", "c.mp4"]);
    // The dropped one finishing late changes nothing.
    expect(onceReady(twice, 1)).toBe(twice);
  });

  it("going back to what's on screen just stops loading", () => {
    expect(withNext(withNext(shown, "b.mp4", 1), "a.mp4", 2)).toEqual(shown);
  });
});
