import { afterEach, describe, expect, it, vi } from "vitest";
import { createQuestionDocx, openQuestionPrintView, type ExportQuestion } from "./questionExport";

const sampleQuestion: ExportQuestion = {
  id: 1,
  questionText: "다음 자료를 보고 옳은 것을 고르시오.",
  choices: ["ㄱ", "ㄴ", "ㄷ"],
  answer: "②",
  explanation: "자료의 평균은 9이다.",
  intent: "표 자료를 해석한다.",
  difficulty: "중",
  points: 3,
  questionType: "자료 분석형",
  visualSpec: { kind: "table", title: "측정값", columns: ["A", "B"], rows: [["6", "8"], ["10", "12"]] },
};

afterEach(() => vi.unstubAllGlobals());

describe("question document export", () => {
  it("creates separate editable question-paper and answer-sheet DOCX files", async () => {
    const questionPaper = await createQuestionDocx([sampleQuestion], "question-paper");
    const answerSheet = await createQuestionDocx([sampleQuestion], "answer-sheet");

    expect(questionPaper.type).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(answerSheet.type).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(questionPaper.size).toBeGreaterThan(500);
    expect(answerSheet.size).toBeGreaterThan(500);
  });

  it("opens a separate print view for teacher-controlled PDF saving", () => {
    const print = vi.fn();
    const document = { write: vi.fn(), close: vi.fn() };
    const popup = { document, focus: vi.fn(), print };
    const open = vi.fn(() => popup);
    vi.stubGlobal("window", { open, setTimeout: (callback: () => void) => { callback(); return 0; } });

    expect(openQuestionPrintView([sampleQuestion], "answer-sheet")).toBe(true);
    expect(open).toHaveBeenCalledOnce();
    expect(document.write).toHaveBeenCalledWith(expect.stringContaining("정답 및 해설지"));
    expect(document.write).toHaveBeenCalledWith(expect.stringContaining("자료의 평균은 9이다."));
    expect(print).toHaveBeenCalledOnce();
  });

  it("prints a teacher-selected point value without gray question metadata", () => {
    const print = vi.fn();
    const document = { write: vi.fn(), close: vi.fn() };
    const popup = { document, focus: vi.fn(), print };
    vi.stubGlobal("window", { open: vi.fn(() => popup), setTimeout: (callback: () => void) => { callback(); return 0; } });

    expect(openQuestionPrintView([sampleQuestion], "question-paper", undefined, { includePoints: true })).toBe(true);
    const html = document.write.mock.calls[0][0] as string;
    expect(html).toContain("［3점］");
    expect(html).not.toContain("난이도 중");
    expect(html).not.toContain("자료 분석형 ·");
  });

  it("adds the EunmaStudio mark only to a basic-plan student question paper", () => {
    const document = { write: vi.fn(), close: vi.fn() };
    const popup = { document, focus: vi.fn(), print: vi.fn() };
    vi.stubGlobal("window", { open: vi.fn(() => popup), setTimeout: (callback: () => void) => { callback(); return 0; } });

    openQuestionPrintView([sampleQuestion], "question-paper", undefined, { watermark: true });
    expect(document.write.mock.calls[0][0]).toContain("student-watermark");
    document.write.mockClear();
    openQuestionPrintView([sampleQuestion], "answer-sheet", undefined, { watermark: true });
    expect(document.write.mock.calls[0][0]).not.toContain("<div class=\"student-watermark\"");
  });
});
