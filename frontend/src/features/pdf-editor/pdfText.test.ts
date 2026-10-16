import { describe, expect, it } from "vitest";
import { colorsFromOperators, detectTextRuns, findTextMatches, preferEmbeddedFamily, replaceRunText, type FillOps } from "./pdfText";

const ops: FillOps = {
  setFillRGBColor: 1,
  setFillGray: 2,
  setFillCMYKColor: 3,
  setFillColor: 4,
  showText: 5,
  showSpacedText: 6,
  nextLineShowText: 7,
  nextLineSetSpacingShowText: 8,
};

describe("detectTextRuns", () => {
  it("detects a Georgia 14px black run and keeps that style when the text changes", () => {
    const colors = colorsFromOperators([ops.setFillRGBColor, ops.showText], [[0, 0, 0], []], ops);
    const [run] = detectTextRuns(
      {
        items: [
          {
            str: "Invoice #270",
            transform: [14, 0, 0, 14, 72, 700],
            width: 96,
            height: 14,
            fontName: "g_d0_f1",
          },
        ],
        styles: { g_d0_f1: { fontFamily: "Georgia" } },
      },
      colors,
    );

    expect(run.fontFamily).toBe("Georgia");
    expect(run.fontSize).toBe(14);
    expect(run.color).toBe("#000000");
    expect(run.embedFont).toBe("Times");

    const replaced = replaceRunText(run, "268");
    expect(replaced.text).toBe("268");
    expect(replaced.fontSize).toBe(14);
    expect(replaced.color).toBe("#000000");
    expect(replaced.fontFamily).toBe("Georgia");

    const generic = { ...run, fontFamily: "serif", embedFont: "Times" as const };
    expect(preferEmbeddedFamily(generic, ["ABCDEF+Georgia"]).fontFamily).toBe("Georgia");
    expect(preferEmbeddedFamily(generic, ["HUQPOW+Noto-Serif", "VTXKUP+Noto-Serif-Bold"]).fontFamily).toBe("Noto Serif");
  });
});

describe("findTextMatches", () => {
  it("selects a matching run on the next page", () => {
    const matches = findTextMatches(
      [{ id: "page-a" }, { id: "page-b" }],
      {
        "page-a": [{ id: "run-0", text: "Alpha" }],
        "page-b": [{ id: "run-0", text: "Invoice 268" }],
      },
      "268",
    );
    expect(matches).toEqual([{ pageId: "page-b", runId: "run-0" }]);
  });
});
