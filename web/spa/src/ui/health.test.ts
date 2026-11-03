import { expect, test } from "vitest";
import { healthKind } from "./health";

test("a stream's health kind is what the server said, and unknown when it said nothing", () => {
  expect(healthKind({ state: "unknown", reason: "not_reported" })).toBe("unknown");
  expect(healthKind({ state: "", reason: "" })).toBe("unknown");
  expect(healthKind(undefined)).toBe("unknown");
});
