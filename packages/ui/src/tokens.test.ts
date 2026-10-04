import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blockPalette, contrastPairs, contrastRatio, levelTokens, pt } from "./tokens.ts";

describe("design tokens", () => {
  it("all text/background pairs meet WCAG AA (4.5:1)", () => {
    for (const [a, b] of contrastPairs) expect(contrastRatio(a, b), `${a}/${b}`).toBeGreaterThanOrEqual(4.5);
  });
  it("block colours meet WCAG AA with white text (sprint 1 finding)", () => {
    for (const [name, c] of Object.entries(blockPalette)) expect(contrastRatio(c, "#FFFFFF"), name).toBeGreaterThanOrEqual(4.5);
  });
  it("font sizes meet SRS minimums (16pt primary, 14pt lower secondary)", () => {
    expect(levelTokens.l1.fontPt).toBeGreaterThanOrEqual(16);
    expect(levelTokens.l2.fontPt).toBeGreaterThanOrEqual(16);
    expect(levelTokens.l3.fontPt).toBeGreaterThanOrEqual(14);
  });
  it("touch targets are at least 44px", () => {
    for (const t of Object.values(levelTokens)) expect(t.minTargetPx).toBeGreaterThanOrEqual(44);
  });
  it("tokens.css stays in sync with tokens.ts", () => {
    const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
    for (const k of ["l1", "l2", "l3"] as const) {
      const t = levelTokens[k];
      const re = new RegExp(`\\[data-level="${k}"\\][^}]*--ab-font-size: ${pt(t.fontPt).toFixed(2)}px[^}]*--ab-min-target: ${t.minTargetPx}px`);
      expect(css).toMatch(re);
    }
  });
});
