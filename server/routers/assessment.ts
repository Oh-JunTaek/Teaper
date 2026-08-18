import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createAiProviderSetting,
  deleteMaterialForUser,
  createGeneratedQuestion,
  createGenerationRequest,
  createMaterial,
  createReferenceQuestion,
  createOfficialSource,
  dashboardStats,
  ensureOfficialCatalog,
  getAiProviderSettingForUser,
  getGeneratedQuestionDetail,
  getMaterial,
  getMaterialChunksForRag,
  getReferenceQuestionsForRag,
  getSelectedOfficialDocumentsForGeneration,
  getSelectedReferenceQuestionsForGeneration,
  ensurePrototypeSampleQuestions,
  listGeneratedQuestions,
  listAiProviderSettings,
  listMaterials,
  listOfficialDocuments,
  listOfficialDocumentsForUser,
  listPrototypeSamplesForUser,
  listOfficialSourceChanges,
  listOfficialSources,
  listReferenceQuestions,
  listWorkspaceUsers,
  replaceMaterialChunks,
  reviewGeneratedQuestion,
  reviewOfficialSourceChange,
  setWorkspaceUserRole,
  setOfficialDocumentSelection,
  setReferenceQuestionSelection,
  updateMaterialExtraction,
  updateAiProviderVerification,
  updateReferenceQuestion,
} from "../db";
import { storageGetSignedUrl, storagePut } from "../storage";
import { buildQuestionVisual, cosineSimilarity, createTextEmbedding, extractDocumentText, generateDraft, splitIntoChunks, validateDraft } from "../services/assessmentAi";
import { assertAllowedOfficialSourceUrl, checkAllOfficialSources } from "../services/officialSources";
import { buildOfficialEvidenceContext } from "../services/officialEvidence";
import { selectGenerationEvidence } from "../services/generationSelection";
import { canAccessGeneratedQuestion } from "../services/questionAccess";
import { checkProviderConnection, resolveProvider, validateProviderUrl } from "../services/aiProviders";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { createMaterialStorageKey } from "../services/materialStorageKey";
import { createReferenceStorageKey } from "../services/referenceStorageKey";

const materialTypes = ["curriculum", "textbook", "guideline", "teaching", "other"] as const;
const statuses = ["pending_review", "approved", "revised", "rejected", "validation_hold"] as const;
const base64File = z.string().min(8).max(14_000_000);

function ensureFile(input: { base64: string; fileName: string; mimeType: string }) {
  if (!input.mimeType.startsWith("image/") && input.mimeType !== "application/pdf") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "PDF 또는 이미지 파일만 등록할 수 있습니다." });
  }
  if (!input.fileName.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "파일명이 필요합니다." });
}

function ensureExternalUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new TRPCError({ code: "BAD_REQUEST", message: "http 또는 https 웹 링크만 등록할 수 있습니다." });
  return url.toString();
}

function rank<T extends { embedding: number[] }>(query: number[], items: T[]) {
  return items.map(item => ({ item, score: cosineSimilarity(query, item.embedding) })).sort((a, b) => b.score - a.score);
}

function materialContext(rows: Awaited<ReturnType<typeof getMaterialChunksForRag>>, type: "curriculum" | "guideline") {
  return rows.filter(row => row.material.materialType === type).slice(0, 5).map(row => `[자료 ${row.material.id}: ${row.material.title}]\n${row.chunk.content}`).join("\n\n");
}

export const assessmentRouter = router({
  dashboard: protectedProcedure.query(({ ctx }) => dashboardStats(ctx.user.id, ctx.user.role === "admin")),

  materials: router({
    // 교사 개인 자료는 본인 소유 범위에서만 등록·조회·삭제합니다.
    list: protectedProcedure.query(({ ctx }) => listMaterials(ctx.user.id)),
    upload: protectedProcedure.input(z.object({
      title: z.string().min(2).max(255), subject: z.string().min(1).max(80), unit: z.string().min(1).max(120), applicableYear: z.string().min(2).max(20), materialType: z.enum(materialTypes),
      fileName: z.string().min(1).max(255), mimeType: z.string().min(1).max(120), base64: base64File, sourceText: z.string().max(30000).optional(), sourceLocation: z.string().max(255).optional(),
    })).mutation(async ({ ctx, input }) => {
      ensureFile(input);
      const bytes = Buffer.from(input.base64.replace(/^data:[^;]+;base64,/, ""), "base64");
      const stored = await storagePut(createMaterialStorageKey(ctx.user.id, input.fileName), bytes, input.mimeType);
      const isExtractable = input.mimeType.startsWith("image/") || input.mimeType === "application/pdf";
      const materialId = await createMaterial({
        ownerId: ctx.user.id, title: input.title, subject: input.subject, unit: input.unit, applicableYear: input.applicableYear, materialType: input.materialType,
        fileName: input.fileName, mimeType: input.mimeType, fileKey: stored.key, fileUrl: stored.url, sourceLocation: input.sourceLocation || null, sourceText: input.sourceText || null, ocrStatus: isExtractable ? "pending" : "not_required",
      });
      let extractedText = input.sourceText || "";
      let extraction = null as Awaited<ReturnType<typeof extractDocumentText>> | null;
      if (isExtractable) {
        try {
          extraction = await extractDocumentText({ signedUrl: await storageGetSignedUrl(stored.key), mimeType: input.mimeType, fileName: input.fileName });
          extractedText = [input.sourceText, extraction.plainText].filter(Boolean).join("\n\n");
          await updateMaterialExtraction(materialId, { ocrText: extractedText, ocrStructure: extraction, ocrStatus: "completed" });
        } catch (error) {
          await updateMaterialExtraction(materialId, { ocrText: input.sourceText || "", ocrStructure: { error: error instanceof Error ? error.message : "OCR 실패" }, ocrStatus: "failed" });
        }
      }
      if (extractedText.trim()) {
        await replaceMaterialChunks(materialId, splitIntoChunks(extractedText).map(content => ({ content, embedding: createTextEmbedding(content) })));
      }
      return { materialId, fileUrl: stored.url, ocrStatus: extraction ? "completed" : isExtractable ? "failed" : "not_required" };
    }),
    remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const deleted = await deleteMaterialForUser(input.id, ctx.user.id);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "삭제할 참고 자료를 찾을 수 없습니다." });
      return { success: true };
    }),
    registerLink: protectedProcedure.input(z.object({
      title: z.string().min(2).max(255), subject: z.string().min(1).max(80), unit: z.string().min(1).max(120), applicableYear: z.string().min(2).max(20), materialType: z.enum(materialTypes), sourceUrl: z.string().url().max(2000), sourceText: z.string().max(30000).optional(), sourceLocation: z.string().max(255).optional(),
    })).mutation(async ({ ctx, input }) => {
      const sourceUrl = ensureExternalUrl(input.sourceUrl);
      const materialId = await createMaterial({ ownerId: ctx.user.id, title: input.title, subject: input.subject, unit: input.unit, applicableYear: input.applicableYear, materialType: input.materialType, fileName: "웹 링크", mimeType: "text/uri-list", fileKey: sourceUrl, fileUrl: sourceUrl, sourceLocation: input.sourceLocation || null, sourceText: input.sourceText || null, ocrText: input.sourceText || null, ocrStructure: { sourceUrl, registrationMode: "link" }, ocrStatus: "not_required" });
      if (input.sourceText?.trim()) await replaceMaterialChunks(materialId, splitIntoChunks(input.sourceText).map(content => ({ content, embedding: createTextEmbedding(content) })));
      return { materialId, sourceUrl };
    }),
  }),

  officialDocuments: router({
    list: protectedProcedure.input(z.object({ subject: z.string().optional() }).optional()).query(({ ctx, input }) => listOfficialDocumentsForUser(ctx.user.id, input?.subject)),
    setSelection: protectedProcedure.input(z.object({ documentId: z.number().int().positive(), useForGeneration: z.boolean() })).mutation(async ({ ctx, input }) => {
      await setOfficialDocumentSelection(ctx.user.id, input.documentId, input.useForGeneration);
      return { success: true };
    }),
  }),

  aiProviders: router({
    list: protectedProcedure.query(({ ctx }) => listAiProviderSettings(ctx.user.id)),
    create: protectedProcedure.input(z.object({
      providerType: z.enum(["ollama", "openai_compatible", "gemini"]),
      label: z.string().min(2).max(120),
      baseUrl: z.string().max(500).optional(),
      model: z.string().min(2).max(160),
      apiKey: z.string().max(2000).optional(),
      confirmExternalTransfer: z.boolean().default(false),
    })).mutation(async ({ ctx, input }) => {
      const isExternal = input.providerType !== "ollama";
      if (isExternal && !input.confirmExternalTransfer) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "개인 외부 AI를 사용하려면 외부 전송 범위에 동의해야 합니다." });
      }
      try {
        const baseUrl = input.providerType === "gemini"
          ? "https://generativelanguage.googleapis.com"
          : validateProviderUrl(input.providerType, input.baseUrl || (input.providerType === "ollama" ? "http://127.0.0.1:11434" : ""));
        const id = await createAiProviderSetting({
          userId: ctx.user.id,
          providerType: input.providerType,
          label: input.label,
          baseUrl,
          model: input.model,
          apiKey: input.apiKey,
          allowExternalTransfer: isExternal,
          externalTransferConsentAt: isExternal ? new Date() : null,
        });
        return { id };
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "AI 제공자 설정을 저장하지 못했습니다." });
      }
    }),
    verify: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const setting = await getAiProviderSettingForUser(ctx.user.id, input.id);
      if (!setting) throw new TRPCError({ code: "NOT_FOUND", message: "AI 제공자 설정을 찾을 수 없습니다." });
      if (setting.providerType === "ollama" && process.env.LOCAL_APP_MODE !== "true") {
        return { status: "local_app_required", models: [], message: "웹앱에서는 교사 PC의 Ollama에 직접 연결할 수 없습니다. 로컬 앱 브리지에서 연결을 확인하세요." };
      }
      try {
        const result = await checkProviderConnection(resolveProvider(setting, true));
        await updateAiProviderVerification(setting.id, ctx.user.id, "ready");
        return result;
      } catch (error) {
        await updateAiProviderVerification(setting.id, ctx.user.id, "failed");
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "AI 제공자 연결을 확인하지 못했습니다." });
      }
    }),
  }),

  references: router({
    // 기출문제는 원문을 기본 복제하지 않고, 교사가 등록한 유형·출처·PDF 연결을 개인 작업공간에 보관합니다.
    list: protectedProcedure.query(({ ctx }) => listReferenceQuestions(ctx.user.id, ctx.user.role === "admin")),
    prototypeSamples: protectedProcedure.query(({ ctx }) => listPrototypeSamplesForUser(ctx.user.id)),
    preparePrototype: protectedProcedure.mutation(({ ctx }) => ensurePrototypeSampleQuestions(ctx.user.id)),
    setSelection: protectedProcedure.input(z.object({ referenceQuestionId: z.number().int().positive(), useForGeneration: z.boolean() })).mutation(async ({ ctx, input }) => { await setReferenceQuestionSelection(ctx.user.id, input.referenceQuestionId, input.useForGeneration); return { success: true }; }),
    create: protectedProcedure.input(z.object({
      subject: z.string().min(1), unit: z.string().min(1), questionType: z.string().min(1), difficulty: z.string().min(1), points: z.number().int().min(1).max(20), year: z.string().min(2), source: z.string().min(2), questionNumber: z.string().max(60).optional(), sourceLocation: z.string().max(255).optional(),
      questionText: z.string().min(10), choices: z.array(z.string().min(1)).min(2).max(8).optional(), answer: z.string().min(1), explanation: z.string().min(2), intent: z.string().min(2), sourcePdf: z.object({ fileName: z.string().min(1).max(255), mimeType: z.literal("application/pdf"), base64: base64File }).optional(),
    })).mutation(async ({ ctx, input }) => {
      const { sourcePdf, ...reference } = input;
      const stored = sourcePdf ? await storagePut(createReferenceStorageKey(ctx.user.id, sourcePdf.fileName), Buffer.from(sourcePdf.base64.replace(/^data:[^;]+;base64,/, ""), "base64"), sourcePdf.mimeType) : null;
      const embedding = createTextEmbedding([reference.questionText, ...(reference.choices || []), reference.answer, reference.explanation, reference.intent].join(" "));
      const id = await createReferenceQuestion({ ownerId: ctx.user.id, ...reference, choices: reference.choices || null, embedding, sourceFileName: sourcePdf?.fileName || null, sourceFileKey: stored?.key || null, sourceFileUrl: stored?.url || null });
      return { id };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number().int().positive(), subject: z.string().min(1), unit: z.string().min(1), questionType: z.string().min(1), difficulty: z.string().min(1), points: z.number().int().min(1).max(20), year: z.string().min(2), source: z.string().min(2), questionNumber: z.string().max(60).optional(), sourceLocation: z.string().max(255).optional(),
      questionText: z.string().min(10), choices: z.array(z.string().min(1)).min(2).max(8).optional(), answer: z.string().min(1), explanation: z.string().min(2), intent: z.string().min(2), sourcePdf: z.object({ fileName: z.string().min(1).max(255), mimeType: z.literal("application/pdf"), base64: base64File }).optional(),
    })).mutation(async ({ ctx, input }) => {
      const { sourcePdf, ...reference } = input;
      const stored = sourcePdf ? await storagePut(createReferenceStorageKey(ctx.user.id, sourcePdf.fileName), Buffer.from(sourcePdf.base64.replace(/^data:[^;]+;base64,/, ""), "base64"), sourcePdf.mimeType) : null;
      const embedding = createTextEmbedding([reference.questionText, ...(reference.choices || []), reference.answer, reference.explanation, reference.intent].join(" "));
      await updateReferenceQuestion(reference.id, ctx.user.id, { ...reference, choices: reference.choices || null, embedding, ...(stored ? { sourceFileName: sourcePdf?.fileName, sourceFileKey: stored.key, sourceFileUrl: stored.url } : {}) }, ctx.user.role === "admin");
      return { success: true };
    }),
  }),

  generation: router({
    // 생성 단계는 선택 근거→초안→검증→근거 스냅샷을 한 요청 이력으로 묶습니다.
    create: protectedProcedure.input(z.object({
      subject: z.string().min(1), unit: z.string().min(1), difficulty: z.string().min(1), questionType: z.string().min(1), points: z.number().int().min(1).max(20), questionCount: z.number().int().min(1).max(5), additionalRequirements: z.string().max(2000).optional(), providerSettingId: z.number().int().positive().optional(), confirmExternalTransfer: z.boolean().default(false),
    })).mutation(async ({ ctx, input }) => {
      const providerSetting = input.providerSettingId ? await getAiProviderSettingForUser(ctx.user.id, input.providerSettingId) : undefined;
      if (input.providerSettingId && !providerSetting) {
        throw new TRPCError({ code: "NOT_FOUND", message: "선택한 AI 제공자 설정을 찾을 수 없거나 사용할 권한이 없습니다." });
      }
      let provider;
      try {
        provider = resolveProvider(providerSetting, input.confirmExternalTransfer);
      } catch (error) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "AI 제공자 설정을 사용할 수 없습니다." });
      }
      const selectedOfficialDocuments = await getSelectedOfficialDocumentsForGeneration(ctx.user.id, input.subject);
      const corpus = await getMaterialChunksForRag(input.subject, input.unit, ctx.user.id);
      const allReferences = await getReferenceQuestionsForRag(input.subject, input.unit);
      const selectedReferenceRows = await getSelectedReferenceQuestionsForGeneration(ctx.user.id, input.subject, input.unit);
      const selectedEvidence = selectGenerationEvidence(allReferences, selectedReferenceRows, selectedOfficialDocuments);
      const selectedPrototypeReferences = selectedEvidence.references;
      const references = selectedEvidence.references;
      const requestId = await createGenerationRequest({ requesterId: ctx.user.id, subject: input.subject, unit: input.unit, difficulty: input.difficulty, questionType: input.questionType, points: input.points, questionCount: input.questionCount, additionalRequirements: input.additionalRequirements || null, providerType: provider.kind, providerSettingId: provider.providerSettingId ?? null, providerModel: provider.model, externalTransferConsentAt: provider.externalTransfer ? new Date() : null }, selectedEvidence.officialDocumentIds, selectedEvidence.referenceQuestionIds);
      const queryVector = createTextEmbedding(`${input.subject} ${input.unit} ${input.questionType} ${input.difficulty} ${input.additionalRequirements || ""}`);
      const rankedChunks = rank(queryVector, corpus.map(row => ({ ...row, embedding: row.chunk.embedding }))).slice(0, 10);
      const rankedReferences = rank(queryVector, references.map(item => ({ ...item, embedding: item.embedding }))).slice(0, 6);
      const curriculumContext = materialContext(rankedChunks.map(item => item.item), "curriculum");
      const guidelineContext = materialContext(rankedChunks.map(item => item.item), "guideline");
      const selectedOfficialContext = buildOfficialEvidenceContext(selectedOfficialDocuments.map(row => row.document));
      const referenceContext = rankedReferences.map(({ item }) => `[기출 ${item.id}] 유형=${item.questionType}, 난이도=${item.difficulty}, 출제 의도=${item.intent}\n${item.questionText}`).join("\n\n");
      if (!curriculumContext && !referenceContext && !guidelineContext && !selectedOfficialContext) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "같은 과목·단원의 참고 자료 또는 기출문제를 먼저 등록해 주세요." });
      }
      const created: number[] = [];
      for (let index = 0; index < input.questionCount; index += 1) {
        let finalDraft = null as Awaited<ReturnType<typeof generateDraft>> | null;
        let finalValidation = null as Awaited<ReturnType<typeof validateDraft>> | null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const generated = await generateDraft({ ...input, curriculumContext: [curriculumContext, selectedOfficialContext].filter(Boolean).join("\n\n"), referenceContext, guidelineContext, additionalRequirements: `${input.additionalRequirements || ""}\n선택된 공식 문서: ${selectedOfficialDocuments.map(row => row.document.title).join(", ") || "없음"}\n재생성 시도: ${attempt + 1}` }, provider);
          const draftVector = createTextEmbedding([generated.draft.questionText, ...(generated.draft.choices || []), generated.draft.answer].join(" "));
          const closest = references.map(item => ({ id: item.id, score: cosineSimilarity(draftVector, item.embedding) })).sort((a, b) => b.score - a.score)[0];
          const closestReference = closest ? references.find(item => item.id === closest.id) : undefined;
          const validation = await validateDraft({ draft: generated.draft, subject: input.subject, unit: input.unit, difficulty: input.difficulty, curriculumContext, guidelineContext, similarityScore: closest?.score || 0, similarReferenceId: closest?.id || null, similarReference: closestReference ? { questionText: closestReference.questionText, choices: closestReference.choices, intent: closestReference.intent } : undefined }, provider);
          finalDraft = generated;
          finalValidation = validation;
          if (validation.pass) break;
        }
        if (!finalDraft || !finalValidation) throw new Error("문항 생성 결과를 만들지 못했습니다.");
        const sources = [
          ...rankedChunks.map(({ item }) => ({ sourceType: item.material.materialType === "guideline" ? "guideline" as const : "material" as const, sourceId: item.material.id, excerpt: item.chunk.content.slice(0, 500), sourceSnapshot: { title: item.material.title, fileName: item.material.fileName, sourceLocation: item.material.sourceLocation || `검색 발췌 ${item.chunk.chunkIndex + 1}번`, chunkIndex: item.chunk.chunkIndex, materialType: item.material.materialType } })),
          ...rankedReferences.map(({ item }) => ({ sourceType: "reference_question" as const, sourceId: item.id, excerpt: item.intent, sourceSnapshot: { source: item.source, year: item.year, questionNumber: item.questionNumber || null, sourceLocation: item.sourceLocation || null, questionType: item.questionType, intent: item.intent } })),
        ];
        const questionId = await createGeneratedQuestion({
          requestId, creatorId: ctx.user.id, questionText: finalDraft.draft.questionText, choices: finalDraft.draft.choices, answer: finalDraft.draft.answer, explanation: finalDraft.draft.explanation,
          intent: finalDraft.draft.intent, difficulty: input.difficulty, points: input.points, questionType: input.questionType, usedConcepts: finalDraft.draft.usedConcepts,
          validationReport: finalValidation, visualSpec: finalDraft.draft.visualSpec || buildQuestionVisual(input), model: finalDraft.model, promptVersion: "chem-rag-v1.0", status: finalValidation.pass ? "pending_review" : "validation_hold",
        }, sources);
        created.push(questionId);
      }
      return { requestId, questionIds: created };
    }),
  }),

  questions: router({
    list: protectedProcedure.input(z.object({ status: z.enum(statuses).optional() }).optional()).query(({ ctx, input }) => listGeneratedQuestions(input?.status, ctx.user.id, ctx.user.role === "admin")),
    detail: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const detail = await getGeneratedQuestionDetail(input.id, ctx.user.id, ctx.user.role === "admin");
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "문항을 찾을 수 없습니다." });
      return detail;
    }),
    review: protectedProcedure.input(z.object({
      id: z.number().int().positive(), action: z.enum(["approved", "revised", "rejected"]), reason: z.string().min(2).max(2000),
      questionText: z.string().min(10).optional(), choices: z.array(z.string().min(1)).min(2).max(8).optional(), answer: z.string().min(1).optional(), explanation: z.string().min(2).optional(), intent: z.string().min(2).optional(),
    })).mutation(async ({ ctx, input }) => {
      const detail = await getGeneratedQuestionDetail(input.id, ctx.user.id, ctx.user.role === "admin");
      if (!detail || !canAccessGeneratedQuestion({ viewerId: ctx.user.id, viewerRole: ctx.user.role, creatorId: detail.question.creatorId })) throw new TRPCError({ code: "NOT_FOUND", message: "문항을 찾을 수 없습니다." });
      await reviewGeneratedQuestion({ reviewerId: ctx.user.id, ...input });
      return { success: true };
    }),
    exportCsv: protectedProcedure.query(async ({ ctx }) => {
      const approved = await listGeneratedQuestions("approved", ctx.user.id, ctx.user.role === "admin");
      const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const header = ["ID", "문제", "보기", "정답", "해설", "출제 의도", "난이도", "배점", "유형", "모델", "프롬프트 버전", "검수 상태"];
      const rows = approved.map(item => [item.id, item.questionText, (item.choices || []).join(" | "), item.answer, item.explanation, item.intent, item.difficulty, item.points, item.questionType, item.model, item.promptVersion, item.status]);
      return { csv: [header, ...rows].map(row => row.map(escape).join(",")).join("\n"), count: approved.length };
    }),
  }),

  admin: router({
    overview: adminProcedure.query(() => dashboardStats(undefined, true)),
    users: adminProcedure.query(() => listWorkspaceUsers()),
    setRole: adminProcedure.input(z.object({ userId: z.number().int().positive(), role: z.enum(["teacher", "admin"]) })).mutation(async ({ ctx, input }) => {
      if (ctx.user.id === input.userId && input.role !== "admin") throw new TRPCError({ code: "BAD_REQUEST", message: "본인의 관리자 권한은 해제할 수 없습니다." });
      await setWorkspaceUserRole(input.userId, input.role);
      return { success: true };
    }),
    officialSources: adminProcedure.query(() => listOfficialSources()),
    createOfficialSource: adminProcedure.input(z.object({ provider: z.string().min(2).max(160), title: z.string().min(2).max(255), sourceType: z.enum(["ministry", "curriculum_center", "education_office"]), listingUrl: z.string().url(), allowedUse: z.enum(["link_only", "metadata_only"]).default("link_only") })).mutation(async ({ input }) => {
      assertAllowedOfficialSourceUrl(input.listingUrl);
      const catalogKey = `${input.sourceType}-${crypto.randomUUID().slice(0, 12)}`;
      const id = await createOfficialSource({ catalogKey, ...input, enabled: 1 });
      return { id };
    }),
    officialChanges: adminProcedure.query(() => listOfficialSourceChanges()),
    syncOfficialSources: adminProcedure.mutation(async () => {
      await ensureOfficialCatalog();
      return { results: await checkAllOfficialSources() };
    }),
    reviewOfficialChange: adminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected"]), reviewNote: z.string().min(2).max(1000) })).mutation(async ({ ctx, input }) => {
      const result = await reviewOfficialSourceChange(input.id, ctx.user.id, input.status, input.reviewNote);
      return { success: true, ...result };
    }),
  }),
});
