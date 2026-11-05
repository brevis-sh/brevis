import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { useSaid } from "./said";

const qc = new QueryClient();
qc.setQueryData(["session"], { operator: "o", lang: "en" });
qc.setQueryData(["messages", "en"], {
  lang: "en",
  messages: {
    "catalog.why.paused": "Its schedule is paused, so it is never late.",
    "catalog.why.unnamed": "Unnamed: {note}.",
    "summary.unit.minute": { one: "1 minute", other: "{count} minutes" },
  },
});
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
const say = () => renderHook(() => useSaid(), { wrapper }).result.current;

describe("useSaid", () => {
  it("shows a name as it is, says a message, and writes nothing for none", () => {
    expect(say()("orders")).toBe("orders");
    expect(say()({ k: "summary.unit.minute", n: 2 })).toBe("2 minutes");
    expect(say()(null)).toBe("");
    expect(say()(undefined)).toBe("");
  });

  it("reads several sentences as one passage", () => {
    expect(say()([{ k: "catalog.why.paused" }, { k: "catalog.why.unnamed", a: { note: "n" } }])).toBe("Its schedule is paused, so it is never late. Unnamed: n.");
    expect(say()([])).toBe("");
  });
});
