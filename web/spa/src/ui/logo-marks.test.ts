import { describe, expect, it } from "vitest";
import { marks } from "./logo-marks";

// A mark is drawn inline, once per tile, so an `id` repeats on the page. A
// `url(#id)` then resolves to the FIRST copy, and when that one sits in a hidden
// element the fill is gone for every other tile (the Python mark vanished from
// the recent runs). Marks are flat fills only.
describe("logo marks", () => {
  it("draw no gradient, pattern or other referenced paint", () => {
    for (const [key, svg] of Object.entries(marks)) {
      expect(svg, key).not.toMatch(/url\(#|<(linear|radial)Gradient|<pattern|<clipPath|<mask|\sid="/);
    }
  });
});
