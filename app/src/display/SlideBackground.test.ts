import { describe, expect, it } from "vitest";
import { savedStillUrl } from "./SlideBackground";

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
