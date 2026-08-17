import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const db = vi.hoisted(() => ({
  createGeneratedQuestion: vi.fn().mockResolvedValue(901),
  createGenerationRequest: vi.fn().mockResolvedValue(501),
  dashboardStats: vi.fn(),
  getMaterialChunksForRag: vi.fn().mockResolvedValue([]),
  getReferenceQuestionsForRag: vi.fn().mockResolvedValue([{ id: 11, subject: "화학 I", unit: "화학 결합", questionType: "개념 확인형", difficulty: "중", points: 3, year: "프로토타입", source: "프로토타입 샘플", questionText: "샘플 문제", choices: ["A", "B"], answer: "1", explanation: "설명", intent: "의도", embedding: [1] }]),
  getSelectedOfficialDocumentsForGeneration: vi.fn().mockResolvedValue([{ document: { id: 7, title: "화학 I 공식 문서", subject: "화학 I", applicableYear: "2026", officialUrl: "https://ncic.re.kr/sample", summary: "공식 범위", rightsStatus: "link_only" }, source: { provider: "교육부" } }]),
  getSelectedReferenceQuestionsForGeneration: vi.fn().mockResolvedValue([{ question: { id: 11 }, selection: { useForGeneration: 1 } }]),
  ensurePrototypeSampleQuestions: vi.fn().mockResolvedValue({ created: 2, ids: [11, 12], label: "프로토타입 샘플" }),
}));

vi.mock("../db", () => ({
  ...db,
  createMaterial: vi.fn(), createReferenceQuestion: vi.fn(), createOfficialSource: vi.fn(), ensureOfficialCatalog: vi.fn(), getGeneratedQuestionDetail: vi.fn(), getMaterial: vi.fn(), getSelectedOfficialDocumentsForGeneration: db.getSelectedOfficialDocumentsForGeneration, getSelectedReferenceQuestionsForGeneration: db.getSelectedReferenceQuestionsForGeneration, listGeneratedQuestions: vi.fn(), listMaterials: vi.fn(), listOfficialDocuments: vi.fn(), listOfficialDocumentsForUser: vi.fn(), listOfficialSourceChanges: vi.fn(), listOfficialSources: vi.fn(), listPrototypeSamplesForUser: vi.fn(), listReferenceQuestions: vi.fn(), listWorkspaceUsers: vi.fn(), replaceMaterialChunks: vi.fn(), reviewGeneratedQuestion: vi.fn(), reviewOfficialSourceChange: vi.fn(), setReferenceQuestionSelection: vi.fn(), setOfficialDocumentSelection: vi.fn(), setWorkspaceUserRole: vi.fn(), updateMaterialExtraction: vi.fn(), updateReferenceQuestion: vi.fn(),
}));

vi.mock("../services/assessmentAi", () => ({
  cosineSimilarity: vi.fn().mockReturnValue(0.1),
  createTextEmbedding: vi.fn().mockReturnValue([1]),
  extractDocumentText: vi.fn(),
  generateDraft: vi.fn().mockResolvedValue({ model: "test-model", draft: { questionText: "새 문항", choices: ["A", "B"], answer: "1", explanation: "설명", intent: "의도", usedConcepts: ["화학 결합"] } }),
  splitIntoChunks: vi.fn(),
  validateDraft: vi.fn().mockResolvedValue({ inScope: true, answerExplanationConsistent: true, difficultyAppropriate: true, guidanceCompliant: true, notes: [], similarityScore: 0.1, similarReferenceId: 11, pass: true, model: "validator" }),
}));

import { assessmentRouter } from "./assessment";

function context(): TrpcContext {
  const now = new Date();
  return { user: { id: 42, openId: "teacher", email: "teacher@example.com", name: "Teacher", loginMethod: "manus", role: "teacher", createdAt: now, updatedAt: now, lastSignedIn: now }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] as TrpcContext["res"] };
}

describe("generation request evidence integration", () => {
  it("passes selected official and prototype reference IDs into the generation request", async () => {
    const caller = assessmentRouter.createCaller(context());
    await caller.references.preparePrototype();
    await caller.generation.create({ subject: "화학 I", unit: "화학 결합", difficulty: "중", questionType: "개념 확인형", points: 3, questionCount: 1 });

    expect(db.ensurePrototypeSampleQuestions).toHaveBeenCalledWith(42);
    expect(db.createGenerationRequest).toHaveBeenCalledWith(expect.objectContaining({ requesterId: 42 }), [7], [11]);
    expect(db.createGeneratedQuestion).toHaveBeenCalled();
  });
});
