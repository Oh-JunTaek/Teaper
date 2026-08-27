import { describe, expect, it } from "vitest";
import { cosineSimilarity, createTextEmbedding, needsVisionFallback, normalizeQuickQuizQuestions, splitIntoChunks } from "./assessmentAi";

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

  it("uses visual reading only when a PDF has too little selectable text", () => {
    expect(needsVisionFallback("선택 가능한 PDF 텍스트 ".repeat(20))).toBe(false);
    expect(needsVisionFallback("스캔본")).toBe(true);
  });

  it("keeps the selected quick-quiz format consistent before storage", () => {
    const base = { questionText: "공유 결합의 정의는?", answer: "1", explanation: "전자쌍을 공유합니다.", concept: "공유 결합" };
    expect(normalizeQuickQuizQuestions([{ ...base, choices: ["선택 ①: 전자쌍 공유", "② 양성자 이동", "③ 중성자 방출", "④ 빛 흡수"] }], "multiple_choice", 1)[0]).toMatchObject({ choices: ["전자쌍 공유", "양성자 이동", "중성자 방출", "빛 흡수"], answer: "①번" });
    expect(normalizeQuickQuizQuestions([{ ...base, choices: [], answer: "전자쌍 공유" }], "short_answer", 1)[0].choices).toEqual([]);
    expect(normalizeQuickQuizQuestions([{ ...base, questionText: "공유 결합은 전자쌍을 공유한다.", choices: [], answer: "○" }], "ox", 1)[0]).toMatchObject({ choices: ["O", "X"], answer: "O" });
    expect(() => normalizeQuickQuizQuestions([{ ...base, choices: ["하나"] }], "multiple_choice", 1)).toThrow(/보기 4개/);
  });
});
