import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const dbMocks = vi.hoisted(() => ({
  createGeneratedQuestion: vi.fn(), createGenerationRequest: vi.fn(), createMaterial: vi.fn(), createReferenceQuestion: vi.fn(), createOfficialSource: vi.fn(), dashboardStats: vi.fn(), ensureOfficialCatalog: vi.fn(), getGeneratedQuestionDetail: vi.fn(), getMaterial: vi.fn(), getMaterialChunksForRag: vi.fn(), getReferenceQuestionsForRag: vi.fn(), getSelectedOfficialDocumentsForGeneration: vi.fn(), ensurePrototypeSampleQuestions: vi.fn(), listGeneratedQuestions: vi.fn(), listMaterials: vi.fn(), listOfficialDocuments: vi.fn(), listOfficialDocumentsForUser: vi.fn(), listOfficialSourceChanges: vi.fn(), listOfficialSources: vi.fn(), listReferenceQuestions: vi.fn(), listWorkspaceUsers: vi.fn(), replaceMaterialChunks: vi.fn(), reviewGeneratedQuestion: vi.fn(), reviewOfficialSourceChange: vi.fn(), setOfficialDocumentSelection: vi.fn(), setReferenceQuestionSelection: vi.fn(), setWorkspaceUserRole: vi.fn(), updateMaterialExtraction: vi.fn(), updateReferenceQuestion: vi.fn(),
}));

vi.mock("../db", () => dbMocks);

import { assessmentRouter } from "./assessment";

function createAdminContext(): TrpcContext {
  const now = new Date();
  return {
    user: { id: 42, openId: "catalog-admin", email: "admin@example.com", name: "Admin", loginMethod: "manus", role: "admin", createdAt: now, updatedAt: now, lastSignedIn: now },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("official document catalog routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists each teacher's catalog with their selection state", async () => {
    const catalog = [{ document: { id: 9, title: "화학 I" }, source: { provider: "교육부" }, useForGeneration: true }];
    dbMocks.listOfficialDocumentsForUser.mockResolvedValue(catalog);
    const caller = assessmentRouter.createCaller(createAdminContext());

    await expect(caller.officialDocuments.list({ subject: "화학 I" })).resolves.toEqual(catalog);
    expect(dbMocks.listOfficialDocumentsForUser).toHaveBeenCalledWith(42, "화학 I");
  });

  it("stores the teacher's include or exclude choice for a document", async () => {
    const caller = assessmentRouter.createCaller(createAdminContext());

    await expect(caller.officialDocuments.setSelection({ documentId: 9, useForGeneration: false })).resolves.toEqual({ success: true });
    expect(dbMocks.setOfficialDocumentSelection).toHaveBeenCalledWith(42, 9, false);
  });

  it("prepares prototype samples for the signed-in teacher", async () => {
    dbMocks.ensurePrototypeSampleQuestions.mockResolvedValue({ created: 2, ids: [11, 12], label: "프로토타입 샘플" });
    const caller = assessmentRouter.createCaller(createAdminContext());

    await expect(caller.references.preparePrototype()).resolves.toEqual({ created: 2, ids: [11, 12], label: "프로토타입 샘플" });
    expect(dbMocks.ensurePrototypeSampleQuestions).toHaveBeenCalledWith(42);
  });

  it("stores a selected prototype question for the signed-in teacher", async () => {
    const caller = assessmentRouter.createCaller(createAdminContext());

    await expect(caller.references.setSelection({ referenceQuestionId: 11, useForGeneration: true })).resolves.toEqual({ success: true });
    expect(dbMocks.setReferenceQuestionSelection).toHaveBeenCalledWith(42, 11, true);
  });

  it("passes an approved source candidate to the database reflection workflow", async () => {
    dbMocks.reviewOfficialSourceChange.mockResolvedValue({ appliedDocumentCount: 2 });
    const caller = assessmentRouter.createCaller(createAdminContext());

    await expect(caller.admin.reviewOfficialChange({ id: 5, status: "approved", reviewNote: "원문 및 권리 상태를 검토했습니다." })).resolves.toEqual({ success: true, appliedDocumentCount: 2 });
    expect(dbMocks.reviewOfficialSourceChange).toHaveBeenCalledWith(5, 42, "approved", "원문 및 권리 상태를 검토했습니다.");
  });
});
