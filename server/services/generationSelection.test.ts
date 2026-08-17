import { describe, expect, it } from "vitest";
import { selectGenerationEvidence } from "./generationSelection";

describe("generation evidence selection", () => {
  it("keeps only selected sample questions and both evidence ID sets", () => {
    const result = selectGenerationEvidence(
      [{ id: 11, questionText: "샘플 1" }, { id: 12, questionText: "샘플 2" }],
      [{ question: { id: 12 } }],
      [{ document: { id: 7 } }, { document: { id: 8 } }],
    );

    expect(result.references.map(item => item.id)).toEqual([12]);
    expect(result.referenceQuestionIds).toEqual([12]);
    expect(result.officialDocumentIds).toEqual([7, 8]);
  });
});
