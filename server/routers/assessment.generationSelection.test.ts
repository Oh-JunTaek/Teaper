import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
import { encryptPersonalApiKey } from "../services/personalApiCrypto";

const db = vi.hoisted(() => ({
  createGeneratedQuestion: vi.fn().mockResolvedValue(901),
  createGenerationRequest: vi.fn().mockResolvedValue(501),
  createAiProviderSetting: vi.fn().mockResolvedValue(55),
  createQuickQuizSet: vi.fn().mockResolvedValue(811),
  createTeacherSchedule: vi.fn().mockResolvedValue(801),
  createMaterial: vi.fn().mockResolvedValue(701),
  deleteMaterialForUser: vi.fn().mockResolvedValue(true),
  deleteTeacherSchedule: vi.fn().mockResolvedValue(true),
  listTeacherSchedules: vi.fn().mockResolvedValue([]),
  reviewQuickQuizSet: vi.fn().mockResolvedValue(true),
  dashboardStats: vi.fn(),
  getAiProviderSettingForUser: vi.fn().mockResolvedValue({ id: 55, userId: 42, providerType: "ollama", label: "내 PC의 Ollama", baseUrl: "http://127.0.0.1:11434", model: "qwen3:8b", encryptedApiKey: null, allowExternalTransfer: 0, externalTransferConsentAt: null, enabled: 1 }),
  getManagedAiMonthlySuccessCount: vi.fn().mockResolvedValue({ usageMonth: "2026-08", successCount: 0 }),
  getUserAiPreferences: vi.fn().mockResolvedValue({ customInstructions: "계산 과정의 단위를 확인" }),
  getMaterialChunksForRag: vi.fn().mockResolvedValue([]),
  getReferenceQuestionsForRag: vi.fn().mockResolvedValue([{ id: 11, subject: "화학 I", unit: "화학 결합", questionType: "개념 확인형", difficulty: "중", points: 3, year: "프로토타입", source: "프로토타입 샘플", questionText: "샘플 문제", choices: ["A", "B"], answer: "1", explanation: "설명", intent: "의도", embedding: [1] }]),
  getSelectedOfficialDocumentsForGeneration: vi.fn().mockResolvedValue([{ document: { id: 7, title: "화학 I 공식 문서", subject: "화학 I", applicableYear: "2026", officialUrl: "https://ncic.re.kr/sample", summary: "공식 범위", rightsStatus: "link_only" }, source: { provider: "교육부" } }]),
  getSelectedReferenceQuestionsForGeneration: vi.fn().mockResolvedValue([{ question: { id: 11 }, selection: { useForGeneration: 1 } }]),
  saveUserAiPreferences: vi.fn().mockResolvedValue(undefined),
  ensurePrototypeSampleQuestions: vi.fn().mockResolvedValue({ created: 2, ids: [11, 12], label: "프로토타입 샘플" }),
  listReferenceQuestions: vi.fn().mockResolvedValue([]),
  listGeneratedQuestions: vi.fn().mockResolvedValue([{ id: 81, questionText: "플러스 출력 문항", choices: ["①"], answer: "①", explanation: "설명", intent: "의도", difficulty: "중", points: 2, questionType: "개념 확인형", visualSpec: null }]),
  recordManagedAiMonthlySuccess: vi.fn().mockResolvedValue({ usageMonth: "2026-08", successCount: 1 }),
  recordManagedAiUsage: vi.fn().mockResolvedValue(undefined),
  updateReferenceQuestion: vi.fn().mockResolvedValue(undefined),
  updateTeacherSchedule: vi.fn().mockResolvedValue(true),
}));

vi.mock("../db", () => ({
  ...db,
  createAiProviderSetting: db.createAiProviderSetting, createMaterial: db.createMaterial, createQuickQuizSet: db.createQuickQuizSet, createReferenceQuestion: vi.fn(), createOfficialSource: vi.fn(), createTeacherSchedule: db.createTeacherSchedule, deleteMaterialForUser: db.deleteMaterialForUser, deleteTeacherSchedule: db.deleteTeacherSchedule, ensureOfficialCatalog: vi.fn(), getAiProviderSettingForUser: db.getAiProviderSettingForUser, getGeneratedQuestionDetail: vi.fn(), getManagedAiMonthlySuccessCount: db.getManagedAiMonthlySuccessCount, getManagedAiUsageReport: vi.fn(), getMaterial: vi.fn(), getSelectedOfficialDocumentsForGeneration: db.getSelectedOfficialDocumentsForGeneration, getSelectedReferenceQuestionsForGeneration: db.getSelectedReferenceQuestionsForGeneration, getUserAiPreferences: db.getUserAiPreferences, listAiProviderSettings: vi.fn(), listGeneratedQuestions: db.listGeneratedQuestions, listMaterials: vi.fn(), listOfficialDocuments: vi.fn(), listOfficialDocumentsForUser: vi.fn(), listOfficialSourceChanges: vi.fn(), listOfficialSources: vi.fn(), listPrototypeSamplesForUser: vi.fn(), listQuickQuizSets: vi.fn(), listReferenceQuestions: db.listReferenceQuestions, listTeacherSchedules: db.listTeacherSchedules, listWorkspaceUsers: vi.fn(), recordManagedAiMonthlySuccess: db.recordManagedAiMonthlySuccess, recordManagedAiUsage: db.recordManagedAiUsage, replaceMaterialChunks: vi.fn(), reviewGeneratedQuestion: vi.fn(), reviewQuickQuizSet: db.reviewQuickQuizSet, reviewOfficialSourceChange: vi.fn(), saveUserAiPreferences: db.saveUserAiPreferences, setReferenceQuestionSelection: vi.fn(), setOfficialDocumentSelection: vi.fn(), setWorkspaceUserPlan: vi.fn(), setWorkspaceUserRole: vi.fn(), updateAiProviderVerification: vi.fn(), updateMaterialExtraction: vi.fn(), updateReferenceQuestion: db.updateReferenceQuestion, updateTeacherSchedule: db.updateTeacherSchedule,
}));

vi.mock("../services/assessmentAi", () => ({
  buildQuestionVisual: vi.fn().mockReturnValue(null),
  cosineSimilarity: vi.fn().mockReturnValue(0.1),
  createTextEmbedding: vi.fn().mockReturnValue([1]),
  extractDocumentText: vi.fn(),
  generateQuickQuiz: vi.fn().mockResolvedValue({ model: "test-model", promptVersion: "quick-quiz-v1.1", questions: [{ questionText: "O/X 문항", choices: ["O", "X"], answer: "O", explanation: "설명", concept: "공유 결합" }] }),
  generateDraft: vi.fn().mockResolvedValue({ model: "test-model", draft: { questionText: "새 문항", choices: ["A", "B"], answer: "1", explanation: "설명", intent: "의도", usedConcepts: ["화학 결합"] } }),
  PROMPT_VERSION: "chem-rag-v1.1",
  splitIntoChunks: vi.fn(),
  validateDraft: vi.fn().mockResolvedValue({ inScope: true, answerExplanationConsistent: true, difficultyAppropriate: true, guidanceCompliant: true, notes: [], similarityScore: 0.1, similarReferenceId: 11, pass: true, model: "validator" }),
}));

import { assessmentRouter } from "./assessment";
import { generateDraft, generateQuickQuiz } from "../services/assessmentAi";

function context(): TrpcContext {
  const now = new Date();
  return { user: { id: 42, openId: "teacher", email: "teacher@example.com", name: "Teacher", loginMethod: "manus", role: "teacher", membershipPlan: "basic", createdAt: now, updatedAt: now, lastSignedIn: now }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] as TrpcContext["res"] };
}

describe("generation request evidence integration", () => {
  it("keeps the basic plan out of workbook export while returning the plan summary", async () => {
    const caller = assessmentRouter.createCaller(context());
    await expect(caller.questions.workbookExport()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.plan.me()).resolves.toMatchObject({ plan: "basic", canUseWorkbookExport: false, managedAi: { successCount: 0, monthlySuccessLimit: 3, remainingSuccessCount: 3 } });
  });

  it("returns the current teacher's expanded personal workspace counts", async () => {
    db.dashboardStats.mockResolvedValueOnce({ materialCount: 2, referenceCount: 3, reviewCount: 1, approvedCount: 4, questionCount: 7, noteCount: 5, quickQuizCount: 6, officialDocumentCount: 8 });
    const caller = assessmentRouter.createCaller(context());

    await expect(caller.dashboard()).resolves.toMatchObject({ questionCount: 7, noteCount: 5, quickQuizCount: 6, approvedCount: 4 });
    expect(db.dashboardStats).toHaveBeenCalledWith(42, false);
  });

  it("records quick-quiz review only for the current teacher's set", async () => {
    const caller = assessmentRouter.createCaller(context());
    await expect(caller.quickQuiz.review({ id: 501, status: "approved" })).resolves.toEqual({ success: true });
    expect(db.reviewQuickQuizSet).toHaveBeenCalledWith(501, 42, "approved");
  });

  it("stores the selected quick-quiz format with the current teacher only", async () => {
    const caller = assessmentRouter.createCaller(context());
    await expect(caller.quickQuiz.create({ subject: "화학 I", unit: "화학 결합", topic: "공유 결합", difficulty: "낮음", questionFormat: "ox", questionCount: 1 })).resolves.toMatchObject({ id: 811 });
    expect(generateQuickQuiz).toHaveBeenCalledWith(expect.objectContaining({ questionFormat: "ox", topic: "공유 결합" }), expect.anything());
    expect(db.createQuickQuizSet).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 42, questionFormat: "ox" }));
  });

  it("stores schedule dates only in the current teacher's workspace", async () => {
    const caller = assessmentRouter.createCaller(context());
    await expect(caller.schedules.create({ title: "화학 I 중간고사", scheduleDate: "2026-10-15", scheduleTime: "09:00", eventType: "exam", note: "고사장 확인" })).resolves.toEqual({ id: 801 });
    expect(db.createTeacherSchedule).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 42, title: "화학 I 중간고사", scheduleDate: "2026-10-15" }));
    await expect(caller.schedules.update({ id: 801, title: "화학 I 중간고사", scheduleDate: "2026-10-15", scheduleTime: "09:00", eventType: "exam", note: "고사장 확인", status: "completed" })).resolves.toEqual({ success: true });
    expect(db.updateTeacherSchedule).toHaveBeenCalledWith(expect.objectContaining({ id: 801, ownerId: 42, status: "completed" }));
    await caller.schedules.remove({ id: 801 });
    expect(db.deleteTeacherSchedule).toHaveBeenCalledWith(801, 42);
  });

  it("blocks managed AI before generation when the plan's monthly successful-work limit is exhausted", async () => {
    db.getManagedAiMonthlySuccessCount.mockResolvedValueOnce({ usageMonth: "2026-08", successCount: 3 });
    const caller = assessmentRouter.createCaller(context());
    await expect(caller.generation.create({ subject: "화학 I", unit: "화학 결합", difficulty: "중", questionType: "개념 확인형", points: 3, questionCount: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows a plus-plan teacher to request approved questions for the workbook composer", async () => {
    const plusContext = context();
    plusContext.user!.membershipPlan = "plus";
    const caller = assessmentRouter.createCaller(plusContext);

    await expect(caller.questions.workbookExport()).resolves.toHaveLength(1);
    await expect(caller.plan.me()).resolves.toMatchObject({ plan: "plus", canUseWorkbookExport: true });
  });

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

  it("blocks a preparing subject before it can create a generation request", async () => {
    db.createGenerationRequest.mockClear();
    const caller = assessmentRouter.createCaller(context());

    await expect(caller.generation.create({ subject: "미적분Ⅰ", unit: "공통", difficulty: "중", questionType: "계산형", points: 3, questionCount: 1 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.createGenerationRequest).not.toHaveBeenCalled();
  });

  it("records a deterministic middle-school calculation check in the validation report", async () => {
    vi.mocked(generateDraft).mockResolvedValueOnce({ model: "test-model", draft: { questionText: "2x+3=11일 때 x의 값은?", choices: ["3", "4", "5", "6"], answer: "4", explanation: "2x=8이므로 x=4이다.", intent: "일차방정식의 해", usedConcepts: ["일차방정식"], calculation: { kind: "linear_equation", expression: "2*x+3=11", expectedAnswer: "4" } } });
    const caller = assessmentRouter.createCaller(context());
    await caller.generation.create({ subject: "중등 수학", unit: "일차방정식", difficulty: "중", questionType: "계산형", points: 3, questionCount: 1 });

    expect(db.createGeneratedQuestion).toHaveBeenLastCalledWith(expect.objectContaining({ validationReport: expect.objectContaining({ calculationCheck: expect.objectContaining({ status: "checked_match", computedAnswer: "4" }) }) }), expect.any(Array));
  });

  it("records managed generation and validation as anonymized aggregate usage", async () => {
    db.recordManagedAiUsage.mockClear();
    const caller = assessmentRouter.createCaller(context());
    await caller.generation.create({ subject: "화학 I", unit: "화학 결합", difficulty: "중", questionType: "개념 확인형", points: 3, questionCount: 1 });

    expect(db.recordManagedAiUsage).toHaveBeenCalledTimes(2);
    expect(db.recordManagedAiUsage).toHaveBeenNthCalledWith(1, expect.objectContaining({ operation: "generation", outcome: "success", model: "test-model" }));
    expect(db.recordManagedAiUsage).toHaveBeenNthCalledWith(2, expect.objectContaining({ operation: "validation", outcome: "success", model: "validator" }));
    expect(db.recordManagedAiUsage.mock.calls.flat().every((entry: Record<string, unknown>) => !("userId" in entry) && !("prompt" in entry))).toBe(true);
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

  it("stores the teacher's additional writing preference in their own workspace", async () => {
    const caller = assessmentRouter.createCaller(context());
    await caller.aiProviders.savePreferences({ customInstructions: "계산 과정의 단위를 반드시 확인" });
    expect(db.saveUserAiPreferences).toHaveBeenCalledWith(42, "계산 과정의 단위를 반드시 확인");
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
