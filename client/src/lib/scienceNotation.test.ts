import { describe, expect, it } from "vitest";
import { formatScienceNotation } from "./scienceNotation";

describe("formatScienceNotation", () => {
  it("converts plain chemical formulae, ions, electron configurations, and LaTex fragments", () => {
    expect(formatScienceNotation("H2O와 CO2, Na+")) .toBe("H₂O와 CO₂, Na⁺");
    expect(formatScienceNotation("1s2 2s2 2p6")) .toBe("1s² 2s² 2p⁶");
    expect(formatScienceNotation("$\\text{SO}_4^{2-}$와 \\delta^-")) .toBe("SO₄²⁻와 δ⁻");
  });
});
