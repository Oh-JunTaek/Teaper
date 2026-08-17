import { describe, expect, it } from "vitest";
import { cosineSimilarity, createTextEmbedding, splitIntoChunks } from "./assessmentAi";

describe("assessmentAi retrieval helpers", () => {
  it("creates stable normalized vectors for the same educational text", () => {
    const first = createTextEmbedding("화학 결합과 분자의 성질");
    const second = createTextEmbedding("화학 결합과 분자의 성질");

    expect(first).toEqual(second);
    expect(first).toHaveLength(128);
    expect(cosineSimilarity(first, second)).toBeCloseTo(1, 4);
  });

  it("ranks a related chemistry text above an unrelated text", () => {
    const query = createTextEmbedding("화학 결합의 전기음성도와 분자 구조");
    const related = createTextEmbedding("전기음성도 차이에 따른 화학 결합과 분자의 구조");
    const unrelated = createTextEmbedding("판 구조론과 지진파의 이동 경로");

    expect(cosineSimilarity(query, related)).toBeGreaterThan(cosineSimilarity(query, unrelated));
  });

  it("splits long OCR text into non-empty chunks without losing the ending", () => {
    const source = `${"가".repeat(1000)}\n\n${"나".repeat(1000)}`;
    const chunks = splitIntoChunks(source, 900);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => chunk.length > 0)).toBe(true);
    expect(chunks.join("")).toContain("나".repeat(100));
  });
});
