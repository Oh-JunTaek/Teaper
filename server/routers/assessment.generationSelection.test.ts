import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
import { encryptPersonalApiKey } from "../services/personalApiCrypto";

const db = vi.hoisted(() => ({
  createGeneratedQuestion: vi.fn().mockResolvedValue(901),
  createGenerationRequest: vi.fn().mockResolvedValue(501),
  createAiProviderSetting: vi.fn().mockResolvedValue(55),
  createMaterial: vi.fn().mockResolvedValue(701),
  deleteMaterialForUser: vi.fn().mockResolvedValue(true),
  dashboardStats: vi.fn(),
  getAiProviderSettingForUser: vi.fn().mockResolvedValue({ id: 55, userId: 42, providerType: "ollama", label: "내 PC의 Ollama", baseUrl: "http://127.0.0.1:11434", model: "qwen3:8b", encryptedApiKey: null, allowExternalTransfer: 0, externalTransferConsentAt: null, enabled: 1 }),
  getMaterialChunksForRag: vi.fn().mockResolvedValue([]),
  getReferenceQuestionsForRag: vi.fn().mockResolvedValue([{ id: 11, subject: "화학 I", unit: "화학 결합", questionType: "개념 확인형", difficulty: "중", points: 3, year: "프로토타입", source: "프로토타입 샘플", questionText: "샘플 문제", choices: ["A", "B"], answer: "1", explanation: "설명", intent: "의도", embedding: [1] }]),
  getSelectedOfficialDocumentsForGeneration: vi.fn().mockResolvedValue([{ document: { id: 7, title: "화학 I 공식 문서", subject: "화학 I", applicableYear: "2026", officialUrl: "https://ncic.re.kr/sample", summary: "공식 범위", rightsStatus: "link_only" }, source: { provider: "교육부" } }]),
  getSelectedReferenceQuestionsForGeneration: vi.fn().mockResolvedValue([{ question: { id: 11 }, selection: { useForGeneration: 1 } }]),
  ensurePrototypeSampleQuestions: vi.fn().mockResolvedValue({ created: 2, ids: [11, 12], label: "프로토타입 샘플" }),
  listReferenceQuestions: vi.fn().mockResolvedValue([]),
  updateReferenceQuestion: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../db", () => ({
  ...db,
  createAiProviderSetting: db.createAiProviderSetting, createMaterial: db.createMaterial, createReferenceQuestion: vi.fn(), createOfficialSource: vi.fn(), deleteMaterialForUser: db.deleteMaterialForUser, ensureOfficialCatalog: vi.fn(), getAiProviderSettingForUser: db.getAiProviderSettingForUser, getGeneratedQuestionDetail: vi.fn(), getMaterial: vi.fn(), getSelectedOfficialDocumentsForGeneration: db.getSelectedOfficialDocumentsForGeneration, getSelectedReferenceQuestionsForGeneration: db.getSelectedReferenceQuestionsForGeneration, listAiProviderSettings: vi.fn(), listGeneratedQuestions: vi.fn(), listMaterials: vi.fn(), listOfficialDocuments: vi.fn(), listOfficialDocumentsForUser: vi.fn(), listOfficialSourceChanges: vi.fn(), listOfficialSources: vi.fn(), listPrototypeSamplesForUser: vi.fn(), listReferenceQuestions: db.listReferenceQuestions, listWorkspaceUsers: vi.fn(), replaceMaterialChunks: vi.fn(), reviewGeneratedQuestion: vi.fn(), reviewOfficialSourceChange: vi.fn(), setReferenceQuestionSelection: vi.fn(), setOfficialDocumentSelection: vi.fn(), setWorkspaceUserRole: vi.fn(), updateAiProviderVerification: vi.fn(), updateMaterialExtraction: vi.fn(), updateReferenceQuestion: db.updateReferenceQuestion,
}));

vi.mock("../services/assessmentAi", () => ({
  buildQuestionVisual: vi.fn().mockReturnValue(null),
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
  it("soft-deletes only a material owned by the current teacher", async () => {
    const caller = assessmentRouter.createCaller(context());
    await caller.materials.remove({ id: 701 });

    expect(db.deleteMaterialForUser).toHaveBeenCalledWith(701, 42);
  });

  it("registers an external material link without fetching or copying its source", async () => {
    const caller = assessmentRouter.createCaller(context());
    await caller.materials.registerLink({ title: "학교 평가계획 안내", subject: "화학 I", unit: "공통", applicableYear: "2026", materialType: "guideline", sourceUrl: "https://school.example.kr/plan" });

    expect(db.createMaterial).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 42, fileName: "웹 링크", fileKey: "https://school.example.kr/plan", fileUrl: "https://school.example.kr/plan", ocrStatus: "not_required" }));
  });

  it("limits a teacher's past-exam list and update to their own workspace", async () => {
    const caller = assessmentRouter.createCaller(context());
    await caller.references.list();
    await caller.references.update({ id: 31, subject: "화학 I", unit: "화학 결합", questionType: "자료 분석형", difficulty: "중", points: 3, year: "2025", source: "공식 기출", questionNumber: "12번", sourceLocation: "문제지 p.4", questionText: "소유권을 확인하는 테스트 문항", choices: ["1", "2"], answer: "1", explanation: "테스트 해설", intent: "테스트 의도" });

    expect(db.listReferenceQuestions).toHaveBeenCalledWith(42, false);
    expect(db.updateReferenceQuestion).toHaveBeenCalledWith(31, 42, expect.objectContaining({ source: "공식 기출", questionNumber: "12번", sourceLocation: "문제지 p.4" }), false);
  });

  it("passes selected official and prototype reference IDs into the generation request", async () => {
    const caller = assessmentRouter.createCaller(context());
    await caller.references.preparePrototype();
    await caller.generation.create({ subject: "화학 I", unit: "화학 결합", difficulty: "중", questionType: "개념 확인형", points: 3, questionCount: 1 });

    expect(db.ensurePrototypeSampleQuestions).toHaveBeenCalledWith(42);
    expect(db.createGenerationRequest).toHaveBeenCalledWith(expect.objectContaining({ requesterId: 42 }), [7], [11]);
    expect(db.createGeneratedQuestion).toHaveBeenCalled();
  });

  it("stores the used material's file, location, and excerpt as evidence snapshot", async () => {
    db.getMaterialChunksForRag.mockResolvedValueOnce([{ material: { id: 77, materialType: "teaching", title: "1학기 화학 I 자료", fileName: "화학I_평가계획.pdf", sourceLocation: "p.3 · 표 2" }, chunk: { chunkIndex: 2, content: "화학 결합의 극성과 분자 구조를 함께 판단한다.", embedding: [1] } }]);
    const caller = assessmentRouter.createCaller(context());
    await caller.generation.create({ subject: "화학 I", unit: "화학 결합", difficulty: "중", questionType: "자료 분석형", points: 3, questionCount: 1 });

    expect(db.createGeneratedQuestion).toHaveBeenLastCalledWith(expect.anything(), expect.arrayContaining([expect.objectContaining({ sourceId: 77, excerpt: "화학 결합의 극성과 분자 구조를 함께 판단한다.", sourceSnapshot: expect.objectContaining({ fileName: "화학I_평가계획.pdf", sourceLocation: "p.3 · 표 2", chunkIndex: 2 }) })]));
  });

  it("records a selected local provider in the generation request", async () => {
    const caller = assessmentRouter.createCaller(context());
    await caller.generation.create({ subject: "화학 I", unit: "화학 결합", difficulty: "중", questionType: "개념 확인형", points: 3, questionCount: 1, providerSettingId: 55, confirmExternalTransfer: false });

    expect(db.getAiProviderSettingForUser).toHaveBeenCalledWith(42, 55);
    expect(db.createGenerationRequest).toHaveBeenCalledWith(expect.objectContaining({ providerType: "ollama", providerSettingId: 55, providerModel: "qwen3:8b", externalTransferConsentAt: null }), [7], [11]);
  });

  it("blocks an external provider when per-request transfer consent is absent", async () => {
    db.getAiProviderSettingForUser.mockResolvedValueOnce({ id: 56, userId: 42, providerType: "gemini", label: "개인 Gemini", baseUrl: "https://generativelanguage.googleapis.com", model: "gemini-2.5-flash", encryptedApiKey: "unused-before-consent", allowExternalTransfer: 1, externalTransferConsentAt: new Date(), enabled: 1 });
    const caller = assessmentRouter.createCaller(context());

    await expect(caller.generation.create({ subject: "화학 I", unit: "화학 결합", difficulty: "중", questionType: "개념 확인형", points: 3, questionCount: 1, providerSettingId: 56, confirmExternalTransfer: false })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("stores a loopback Ollama setting without an external transfer consent", async () => {
    const caller = assessmentRouter.createCaller(context());
    await caller.aiProviders.create({ providerType: "ollama", label: "내 PC의 Ollama", baseUrl: "http://127.0.0.1:11434", model: "qwen3:8b", confirmExternalTransfer: false });

    expect(db.createAiProviderSetting).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, providerType: "ollama", allowExternalTransfer: false, baseUrl: "http://127.0.0.1:11434" }));
  });

  it("requires consent before creating an external personal API setting", async () => {
    const caller = assessmentRouter.createCaller(context());
    await expect(caller.aiProviders.create({ providerType: "gemini", label: "개인 Gemini", model: "gemini-2.5-flash", apiKey: "test-key", confirmExternalTransfer: false })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("does not attempt to contact a teacher PC Ollama from the web server", async () => {
    const caller = assessmentRouter.createCaller(context());
    await expect(caller.aiProviders.verify({ id: 55 })).resolves.toMatchObject({ status: "local_app_required" });
  });

  it("rejects an AI setting owned by another user and disallows a remote Ollama address", async () => {
    const caller = assessmentRouter.createCaller(context());
    db.getAiProviderSettingForUser.mockResolvedValueOnce(undefined);
    await expect(caller.generation.create({ subject: "화학 I", unit: "화학 결합", difficulty: "중", questionType: "개념 확인형", points: 3, questionCount: 1, providerSettingId: 999, confirmExternalTransfer: false })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.aiProviders.create({ providerType: "ollama", label: "원격 Ollama", baseUrl: "https://remote.example.com", model: "qwen3:8b", confirmExternalTransfer: false })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("records external provider consent with the selected model in the generation history", async () => {
    db.getAiProviderSettingForUser.mockResolvedValueOnce({ id: 56, userId: 42, providerType: "gemini", label: "개인 Gemini", baseUrl: "https://generativelanguage.googleapis.com", model: "gemini-2.5-flash", encryptedApiKey: encryptPersonalApiKey("test-personal-key"), allowExternalTransfer: 1, externalTransferConsentAt: new Date(), enabled: 1 });
    const caller = assessmentRouter.createCaller(context());
    await caller.generation.create({ subject: "화학 I", unit: "화학 결합", difficulty: "중", questionType: "개념 확인형", points: 3, questionCount: 1, providerSettingId: 56, confirmExternalTransfer: true });

    expect(db.createGenerationRequest).toHaveBeenCalledWith(expect.objectContaining({ providerType: "gemini", providerSettingId: 56, providerModel: "gemini-2.5-flash", externalTransferConsentAt: expect.any(Date) }), [7], [11]);
  });
});
