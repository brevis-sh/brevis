import { describe, expect, it } from "vitest";
import { parseAnsi, stripAnsi } from "./ansi";

const E = "\x1b";

describe("parseAnsi", () => {
  it("colors dbt's OK and PASS and resets after", () => {
    const s = parseAnsi(`1 of 7 OK [${E}[32mPASS${E}[0m in 0.6s]`);
    expect(s.map((x) => [x.text, x.fg])).toEqual([["1 of 7 OK [", undefined], ["PASS", 2], [" in 0.6s]", undefined]]);
  });

  it("handles bright colors, bold and an empty reset", () => {
    const s = parseAnsi(`${E}[1;91mboom${E}[m!`);
    expect(s[0]).toMatchObject({ text: "boom", fg: 9, bold: true });
    expect(s[1]).toEqual({ text: "!" });
  });

  it("consumes 256-color and truecolor without coloring", () => {
    const s = parseAnsi(`${E}[38;5;196mx${E}[38;2;1;2;3;1my`);
    expect(s.map((x) => x.fg)).toEqual([undefined, undefined]);
    expect(s[1]!.bold).toBe(true);
  });

  it("drops non-SGR sequences and stray escapes", () => {
    expect(stripAnsi(`a${E}[2Kb${E}[0Gc${E}d`)).toBe("abcd");
    expect(parseAnsi(`a${E}[2Kb`).map((x) => x.text).join("")).toBe("ab");
  });
});
