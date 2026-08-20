import { and, count, desc, eq, isNull, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  aiProviderSettings,
  generatedQuestions,
  generatedQuestionSources,
  generationOfficialDocuments,
  generationReferenceQuestions,
  generationRequests,
  InsertUser,
  materialChunks,
  managedAiUsageDaily,
  officialDocumentSelections,
  officialDocuments,
  officialSourceChanges,
  officialSources,
  referenceMaterials,
  referenceQuestionSelections,
  referenceQuestions,
  reviewEvents,
  userAiPreferences,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { buildApprovedOfficialDocumentVersion } from "./services/officialCatalogVersion";
import { createTextEmbedding } from "./services/assessmentAi";
import { apiKeyHint, encryptPersonalApiKey } from "./services/personalApiCrypto";
import type { ManagedAiUsageEntry } from "./services/managedAiUsage";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    _db = drizzle(process.env.DATABASE_URL);
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("데이터베이스 연결을 사용할 수 없습니다.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export type ProviderType = "managed" | "ollama" | "openai_compatible" | "gemini" | "anthropic";

export async function recordManagedAiUsage(entry: ManagedAiUsageEntry) {
  const db = await getDb();
  if (!db) return;
  await db.insert(managedAiUsageDaily).values({
    usageDate: entry.usageDate,
    operation: entry.operation,
    outcome: entry.outcome,
    model: entry.model,
    durationBucket: entry.durationBucket,
    callCount: 1,
    knownInputTokens: entry.knownInputTokens || 0,
    knownOutputTokens: entry.knownOutputTokens || 0,
  }).onDuplicateKeyUpdate({
    set: {
      callCount: sql`${managedAiUsageDaily.callCount} + 1`,
      knownInputTokens: sql`${managedAiUsageDaily.knownInputTokens} + ${entry.knownInputTokens || 0}`,
      knownOutputTokens: sql`${managedAiUsageDaily.knownOutputTokens} + ${entry.knownOutputTokens || 0}`,
      updatedAt: new Date(),
    },
  });
}

export async function getManagedAiUsageReport(days = 14) {
  const db = await requireDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Math.max(0, days - 1));
  const cutoffDate = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  const rows = await db.select().from(managedAiUsageDaily).orderBy(desc(managedAiUsageDaily.usageDate), desc(managedAiUsageDaily.updatedAt));
  const recentRows = rows.filter(row => row.usageDate >= cutoffDate);
  const summary = recentRows.reduce((result, row) => ({
    callCount: result.callCount + row.callCount,
    successCount: result.successCount + (row.outcome === "success" ? row.callCount : 0),
    failureCount: result.failureCount + (row.outcome === "failure" ? row.callCount : 0),
    limitedCount: result.limitedCount + (row.outcome === "limited" ? row.callCount : 0),
  }), { callCount: 0, successCount: 0, failureCount: 0, limitedCount: 0 });
  return { retentionDays: 90, days, summary, rows: recentRows };
}

export async function listAiProviderSettings(userId: number) {
  const db = await requireDb();
  return db.select({
    id: aiProviderSettings.id,
    providerType: aiProviderSettings.providerType,
    label: aiProviderSettings.label,
    baseUrl: aiProviderSettings.baseUrl,
    model: aiProviderSettings.model,
    apiKeyHint: aiProviderSettings.apiKeyHint,
    allowExternalTransfer: aiProviderSettings.allowExternalTransfer,
    externalTransferConsentAt: aiProviderSettings.externalTransferConsentAt,
    enabled: aiProviderSettings.enabled,
    lastVerifiedAt: aiProviderSettings.lastVerifiedAt,
    lastVerificationStatus: aiProviderSettings.lastVerificationStatus,
    createdAt: aiProviderSettings.createdAt,
    updatedAt: aiProviderSettings.updatedAt,
  }).from(aiProviderSettings).where(eq(aiProviderSettings.userId, userId)).orderBy(desc(aiProviderSettings.updatedAt));
}

export async function getAiProviderSettingForUser(userId: number, id: number) {
  const db = await requireDb();
  return (await db.select().from(aiProviderSettings).where(and(eq(aiProviderSettings.id, id), eq(aiProviderSettings.userId, userId), eq(aiProviderSettings.enabled, 1))).limit(1))[0];
}

export async function createAiProviderSetting(input: {
  userId: number;
  providerType: Exclude<ProviderType, "managed">;
  label: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  allowExternalTransfer: boolean;
  externalTransferConsentAt?: Date | null;
}) {
  const db = await requireDb();
  const usesApiKey = input.providerType === "openai_compatible" || input.providerType === "gemini" || input.providerType === "anthropic";
  if (usesApiKey && !input.apiKey?.trim()) throw new Error("개인 API 키가 필요합니다.");
  const result = await db.insert(aiProviderSettings).values({
    userId: input.userId,
    providerType: input.providerType,
    label: input.label,
    baseUrl: input.baseUrl,
    model: input.model,
    encryptedApiKey: input.apiKey ? encryptPersonalApiKey(input.apiKey) : null,
    apiKeyHint: input.apiKey ? apiKeyHint(input.apiKey) : null,
    allowExternalTransfer: input.allowExternalTransfer ? 1 : 0,
    externalTransferConsentAt: input.externalTransferConsentAt ?? null,
  });
  return Number(result[0].insertId);
}

export async function updateAiProviderVerification(id: number, userId: number, status: string) {
  const db = await requireDb();
  await db.update(aiProviderSettings).set({ lastVerificationStatus: status, lastVerifiedAt: new Date() }).where(and(eq(aiProviderSettings.id, id), eq(aiProviderSettings.userId, userId)));
}

// 개인화 지시문은 제공자와 독립적으로 보관하며, 문항 원문·근거가 아닌 교사의 작성 선호만 담습니다.
export async function getUserAiPreferences(userId: number) {
  const db = await requireDb();
  return (await db.select().from(userAiPreferences).where(eq(userAiPreferences.userId, userId)).limit(1))[0];
}

export async function saveUserAiPreferences(userId: number, customInstructions: string) {
  const db = await requireDb();
  await db.insert(userAiPreferences).values({ userId, customInstructions }).onDuplicateKeyUpdate({ set: { customInstructions, updatedAt: new Date() } });
}

// 참고 자료는 원본 파일(S3)과 검색용 발췌(DB)를 분리합니다. 이후 삭제·근거 추적의 기준점이 됩니다.
export async function createMaterial(values: typeof referenceMaterials.$inferInsert) {
  const db = await requireDb();
  const result = await db.insert(referenceMaterials).values(values);
  return Number(result[0].insertId);
}

export async function getMaterial(id: number, includeDeleted = false) {
  const db = await requireDb();
  const scope = includeDeleted ? eq(referenceMaterials.id, id) : and(eq(referenceMaterials.id, id), isNull(referenceMaterials.deletedAt));
  return (await db.select().from(referenceMaterials).where(scope).limit(1))[0];
}

export async function listMaterials(ownerId?: number) {
  const db = await requireDb();
  const query = db.select().from(referenceMaterials);
  const scope = [isNull(referenceMaterials.deletedAt)];
  if (ownerId) scope.push(eq(referenceMaterials.ownerId, ownerId));
  return query.where(and(...scope)).orderBy(desc(referenceMaterials.createdAt));
}

// 삭제는 논리 삭제로 처리해 새 생성에서는 제외하되, 이미 검수한 문항의 근거 이력은 재현할 수 있게 합니다.
export async function deleteMaterialForUser(id: number, ownerId: number) {
  const db = await requireDb();
  const material = (await db.select().from(referenceMaterials).where(and(eq(referenceMaterials.id, id), eq(referenceMaterials.ownerId, ownerId), isNull(referenceMaterials.deletedAt))).limit(1))[0];
  if (!material) return false;
  await db.delete(materialChunks).where(eq(materialChunks.materialId, id));
  await db.update(referenceMaterials).set({ deletedAt: new Date() }).where(eq(referenceMaterials.id, id));
  return true;
}

export async function updateMaterialExtraction(id: number, values: { ocrText: string; ocrStructure: unknown; ocrStatus: "completed" | "failed" }) {
  const db = await requireDb();
  await db.update(referenceMaterials).set(values).where(eq(referenceMaterials.id, id));
}

export async function replaceMaterialChunks(materialId: number, chunks: Array<{ content: string; embedding: number[] }>) {
  const db = await requireDb();
  await db.delete(materialChunks).where(eq(materialChunks.materialId, materialId));
  if (chunks.length) {
    await db.insert(materialChunks).values(chunks.map((chunk, chunkIndex) => ({ materialId, chunkIndex, ...chunk })));
  }
}

export async function createReferenceQuestion(values: typeof referenceQuestions.$inferInsert) {
  const db = await requireDb();
  const result = await db.insert(referenceQuestions).values(values);
  return Number(result[0].insertId);
}

export async function listReferenceQuestions(ownerId?: number, includeAll = false) {
  const db = await requireDb();
  const query = db.select().from(referenceQuestions);
  return !includeAll && ownerId ? query.where(eq(referenceQuestions.ownerId, ownerId)).orderBy(desc(referenceQuestions.createdAt)) : query.orderBy(desc(referenceQuestions.createdAt));
}

export async function ensurePrototypeSampleQuestions(ownerId: number) {
  const db = await requireDb();
  const existing = await db.select({ id: referenceQuestions.id }).from(referenceQuestions).where(eq(referenceQuestions.source, "프로토타입 샘플"));
  if (existing.length) {
    await db.insert(referenceQuestionSelections).values(existing.map(row => ({ userId: ownerId, referenceQuestionId: row.id, useForGeneration: 1 }))).onDuplicateKeyUpdate({ set: { useForGeneration: 1 } });
    return { created: 0, ids: existing.map(row => row.id), label: "프로토타입 샘플" };
  }
  const samples = [
    { subject: "화학 I", unit: "화학 결합", questionType: "개념 확인형", difficulty: "중", points: 3, year: "프로토타입", source: "프로토타입 샘플", questionText: "원자 사이의 전기음성도 차이가 클 때 형성되기 쉬운 결합에 대한 설명으로 가장 적절한 것은?", choices: ["전자쌍을 공유하지 않는다", "전자를 한 원자에서 다른 원자로 이동시키는 성격이 커진다", "항상 금속 원자 사이에서만 형성된다", "분자의 극성과 무관하다"], answer: "2", explanation: "전기음성도 차이가 클수록 전자 이동 성격이 커져 이온 결합 성격이 증가한다.", intent: "전기음성도 차이와 결합 성격의 관계를 확인한다." },
    { subject: "화학 I", unit: "화학 결합", questionType: "자료 분석형", difficulty: "상", points: 4, year: "프로토타입", source: "프로토타입 샘플", questionText: "두 분자의 결합 극성과 분자 구조 자료를 비교할 때 분자 전체의 극성을 판단하기 위해 함께 고려해야 할 요소는?", choices: ["원자량만", "결합의 극성과 결합 방향의 벡터 합", "시료의 부피만", "반응 시간만"], answer: "2", explanation: "분자 전체의 극성은 개별 결합의 극성과 공간적 배치에 따른 벡터 합으로 판단한다.", intent: "결합 극성과 분자 구조를 함께 해석하는 능력을 확인한다." },
  ];
  const ids: number[] = [];
  for (const sample of samples) {
    const embedding = createTextEmbedding([sample.questionText, ...sample.choices, sample.answer, sample.explanation, sample.intent].join(" "));
    ids.push(await createReferenceQuestion({ ownerId, ...sample, choices: sample.choices, embedding }));
  }
  await db.insert(referenceQuestionSelections).values(ids.map(referenceQuestionId => ({ userId: ownerId, referenceQuestionId, useForGeneration: 1 })));
  return { created: ids.length, ids, label: "프로토타입 샘플" };
}

export async function listPrototypeSamplesForUser(userId: number) {
  const db = await requireDb();
  const questions = await db.select().from(referenceQuestions).where(eq(referenceQuestions.source, "프로토타입 샘플")).orderBy(referenceQuestions.id);
  const selections = await db.select().from(referenceQuestionSelections).where(eq(referenceQuestionSelections.userId, userId));
  const selected = new Map(selections.map(row => [row.referenceQuestionId, Boolean(row.useForGeneration)]));
  return questions.map(question => ({ question, useForGeneration: selected.get(question.id) ?? false, sourceLabel: "프로토타입 샘플", useScope: "현재 문항 생성의 참고 유형·개념 근거" }));
}

export async function setReferenceQuestionSelection(userId: number, referenceQuestionId: number, useForGeneration: boolean) {
  const db = await requireDb();
  await db.insert(referenceQuestionSelections).values({ userId, referenceQuestionId, useForGeneration: useForGeneration ? 1 : 0 }).onDuplicateKeyUpdate({ set: { useForGeneration: useForGeneration ? 1 : 0 } });
}

export async function getSelectedReferenceQuestionsForGeneration(userId: number, subject: string, unit: string) {
  const db = await requireDb();
  return db.select({ question: referenceQuestions, selection: referenceQuestionSelections }).from(referenceQuestionSelections).innerJoin(referenceQuestions, eq(referenceQuestionSelections.referenceQuestionId, referenceQuestions.id)).where(and(eq(referenceQuestionSelections.userId, userId), eq(referenceQuestionSelections.useForGeneration, 1), eq(referenceQuestions.subject, subject), or(eq(referenceQuestions.unit, unit), eq(referenceQuestions.unit, "공통"))));
}

export async function updateReferenceQuestion(id: number, ownerId: number, values: Omit<typeof referenceQuestions.$inferInsert, "id" | "ownerId" | "createdAt" | "updatedAt">, includeAll = false) {
  const db = await requireDb();
  await db.update(referenceQuestions).set(values).where(!includeAll ? and(eq(referenceQuestions.id, id), eq(referenceQuestions.ownerId, ownerId)) : eq(referenceQuestions.id, id));
}

export async function getReferenceQuestionsForRag(subject: string, unit: string) {
  const db = await requireDb();
  return db.select().from(referenceQuestions).where(and(eq(referenceQuestions.subject, subject), or(eq(referenceQuestions.unit, unit), eq(referenceQuestions.unit, "공통"))));
}

export async function getMaterialChunksForRag(subject: string, unit: string, ownerId?: number) {
  const db = await requireDb();
  const scope = [eq(referenceMaterials.subject, subject), or(eq(referenceMaterials.unit, unit), eq(referenceMaterials.unit, "공통")), isNull(referenceMaterials.deletedAt)];
  if (ownerId) scope.push(eq(referenceMaterials.ownerId, ownerId));
  return db
    .select({ chunk: materialChunks, material: referenceMaterials })
    .from(materialChunks)
    .innerJoin(referenceMaterials, eq(materialChunks.materialId, referenceMaterials.id))
    .where(and(...scope));
}

// 생성 요청과 선택된 공식 문서·기출 유형을 함께 남겨, 나중에 어떤 근거로 초안을 만들었는지 확인합니다.
export async function createGenerationRequest(values: typeof generationRequests.$inferInsert, officialDocumentIds: number[] = [], referenceQuestionIds: number[] = []) {
  const db = await requireDb();
  const result = await db.insert(generationRequests).values(values);
  const requestId = Number(result[0].insertId);
  if (officialDocumentIds.length) {
    await db.insert(generationOfficialDocuments).values(Array.from(new Set(officialDocumentIds)).map(documentId => ({ requestId, documentId })));
  }
  if (referenceQuestionIds.length) {
    await db.insert(generationReferenceQuestions).values(Array.from(new Set(referenceQuestionIds)).map(referenceQuestionId => ({ requestId, referenceQuestionId })));
  }
  return requestId;
}

// 문항 저장 시 실제 발췌·파일명·페이지·문항 번호를 스냅샷으로 보존해 자료가 변경돼도 검수 근거를 확인할 수 있게 합니다.
export async function createGeneratedQuestion(values: typeof generatedQuestions.$inferInsert, sources: Array<{ sourceType: "material" | "reference_question" | "guideline"; sourceId: number; excerpt?: string; sourceSnapshot?: unknown }>) {
  const db = await requireDb();
  const result = await db.insert(generatedQuestions).values(values);
  const questionId = Number(result[0].insertId);
  if (sources.length) {
    await db.insert(generatedQuestionSources).values(sources.map(source => ({ generatedQuestionId: questionId, ...source })));
  }
  return questionId;
}

export async function listGeneratedQuestions(status?: "pending_review" | "approved" | "revised" | "rejected" | "validation_hold", creatorId?: number, includeAll = false) {
  const db = await requireDb();
  const query = db.select().from(generatedQuestions);
  const scope = !includeAll && creatorId ? eq(generatedQuestions.creatorId, creatorId) : undefined;
  const filter = status && scope ? and(eq(generatedQuestions.status, status), scope) : status ? eq(generatedQuestions.status, status) : scope;
  return filter ? query.where(filter).orderBy(desc(generatedQuestions.createdAt)) : query.orderBy(desc(generatedQuestions.createdAt));
}

export async function getGeneratedQuestionDetail(id: number, viewerId?: number, includeAll = false) {
  const db = await requireDb();
  const question = (await db.select().from(generatedQuestions).where(eq(generatedQuestions.id, id)).limit(1))[0];
  if (!question) return undefined;
  if (!includeAll && viewerId !== undefined && question.creatorId !== viewerId) return undefined;
  const generationRequest = (await db.select().from(generationRequests).where(eq(generationRequests.id, question.requestId)).limit(1))[0];
  const sources = await db.select().from(generatedQuestionSources).where(eq(generatedQuestionSources.generatedQuestionId, id));
  const events = await db.select().from(reviewEvents).where(eq(reviewEvents.generatedQuestionId, id)).orderBy(desc(reviewEvents.createdAt));
  const officialDocumentLinks = await db.select({ document: officialDocuments, source: officialSources }).from(generationOfficialDocuments).innerJoin(officialDocuments, eq(generationOfficialDocuments.documentId, officialDocuments.id)).innerJoin(officialSources, eq(officialDocuments.sourceId, officialSources.id)).where(eq(generationOfficialDocuments.requestId, question.requestId));
  const materialIds = sources.filter(s => s.sourceType === "material" || s.sourceType === "guideline").map(s => s.sourceId);
  const referenceIds = sources.filter(s => s.sourceType === "reference_question").map(s => s.sourceId);
  const materials = materialIds.length ? await db.select().from(referenceMaterials).where(or(...materialIds.map(item => eq(referenceMaterials.id, item)))) : [];
  const references = referenceIds.length ? await db.select().from(referenceQuestions).where(or(...referenceIds.map(item => eq(referenceQuestions.id, item)))) : [];
  const materialMap = new Map(materials.map(material => [material.id, material]));
  const referenceMap = new Map(references.map(reference => [reference.id, reference]));
  // 문항 접근 권한을 먼저 확인한 뒤에만, 검수용 근거에 원본 파일 정보와 형식을 함께 제공합니다.
  const sourceEvidence = sources.map(source => {
    const material = source.sourceType === "reference_question" ? undefined : materialMap.get(source.sourceId);
    const reference = source.sourceType === "reference_question" ? referenceMap.get(source.sourceId) : undefined;
    return {
      ...source,
      material,
      reference,
      sourceFileUrl: reference?.sourceFileUrl || material?.fileUrl || null,
      sourceMimeType: reference?.sourceFileUrl ? "application/pdf" : material?.mimeType || null,
    };
  });
  return { question, generationRequest, sources, sourceEvidence, events, materials, references, officialDocuments: officialDocumentLinks };
}

export async function reviewGeneratedQuestion(input: {
  id: number;
  reviewerId: number;
  action: "approved" | "revised" | "rejected";
  reason: string;
  questionText?: string;
  choices?: string[];
  answer?: string;
  explanation?: string;
  intent?: string;
}) {
  const db = await requireDb();
  const before = (await db.select().from(generatedQuestions).where(eq(generatedQuestions.id, input.id)).limit(1))[0];
  if (!before) throw new Error("문항을 찾을 수 없습니다.");
  const status: "approved" | "revised" | "rejected" = input.action === "approved" ? "approved" : input.action === "revised" ? "revised" : "rejected";
  const update = {
    status,
    reviewedBy: input.reviewerId,
    reviewReason: input.reason,
    reviewedAt: new Date(),
    ...(input.questionText !== undefined ? { questionText: input.questionText } : {}),
    ...(input.choices !== undefined ? { choices: input.choices } : {}),
    ...(input.answer !== undefined ? { answer: input.answer } : {}),
    ...(input.explanation !== undefined ? { explanation: input.explanation } : {}),
    ...(input.intent !== undefined ? { intent: input.intent } : {}),
  };
  await db.update(generatedQuestions).set(update).where(eq(generatedQuestions.id, input.id));
  await db.insert(reviewEvents).values({
    generatedQuestionId: input.id,
    reviewerId: input.reviewerId,
    action: input.action,
    reason: input.reason,
    beforeSnapshot: before,
    afterSnapshot: { ...before, ...update },
  });
}

export async function dashboardStats(ownerId?: number, includeAll = false) {
  const db = await requireDb();
  const materialScope = !includeAll && ownerId ? and(eq(referenceMaterials.ownerId, ownerId), isNull(referenceMaterials.deletedAt)) : isNull(referenceMaterials.deletedAt);
  const referenceScope = !includeAll && ownerId ? eq(referenceQuestions.ownerId, ownerId) : undefined;
  const pendingScope = !includeAll && ownerId ? and(eq(generatedQuestions.status, "pending_review"), eq(generatedQuestions.creatorId, ownerId)) : eq(generatedQuestions.status, "pending_review");
  const approvedScope = !includeAll && ownerId ? and(eq(generatedQuestions.status, "approved"), eq(generatedQuestions.creatorId, ownerId)) : eq(generatedQuestions.status, "approved");
  const [materialCount] = await db.select({ value: count() }).from(referenceMaterials).where(materialScope);
  const referenceQuery = db.select({ value: count() }).from(referenceQuestions);
  const [referenceCount] = referenceScope ? await referenceQuery.where(referenceScope) : await referenceQuery;
  const [reviewCount] = await db.select({ value: count() }).from(generatedQuestions).where(pendingScope);
  const [approvedCount] = await db.select({ value: count() }).from(generatedQuestions).where(approvedScope);
  const [officialDocumentCount] = await db.select({ value: count() }).from(officialDocuments).where(eq(officialDocuments.catalogStatus, "published"));
  return { materialCount: Number(materialCount.value), referenceCount: Number(referenceCount.value), reviewCount: Number(reviewCount.value), approvedCount: Number(approvedCount.value), officialDocumentCount: Number(officialDocumentCount.value) };
}

export async function listWorkspaceUsers() {
  const db = await requireDb();
  // 역할 관리에는 이름·역할만 필요하므로 이메일과 최근 로그인 시각은 클라이언트로 전송하지 않습니다.
  return db.select({ id: users.id, name: users.name, role: users.role }).from(users).orderBy(desc(users.lastSignedIn));
}

export async function setWorkspaceUserRole(userId: number, role: "teacher" | "admin") {
  const db = await requireDb();
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

const OFFICIAL_SOURCE_SEEDS = [
  { catalogKey: "moe-2022-curriculum", provider: "교육부", title: "2022 개정 교육과정 고시", sourceType: "ministry" as const, listingUrl: "https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=141&lev=0&statusYN=W&s=moe&m=0404&opType=N&boardSeq=93458", allowedUse: "link_only" as const },
  { catalogKey: "ncic-curriculum", provider: "국가교육과정정보센터", title: "국가교육과정정보센터 원문 인벤토리", sourceType: "curriculum_center" as const, listingUrl: "https://ncic.re.kr/inv/org/list.do?ck=main", allowedUse: "link_only" as const },
  { catalogKey: "moe-2015-curriculum", provider: "교육부", title: "2015 개정 교육과정 고시", sourceType: "ministry" as const, listingUrl: "https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=141&lev=0&statusYN=C&s=moe&m=0404&opType=N&boardSeq=60747", allowedUse: "link_only" as const },
];

export async function ensureOfficialCatalog() {
  const db = await requireDb();
  for (const source of OFFICIAL_SOURCE_SEEDS) {
    await db.insert(officialSources).values(source).onDuplicateKeyUpdate({ set: { title: source.title, listingUrl: source.listingUrl, provider: source.provider } });
  }
  const sources = await db.select().from(officialSources);
  const sourceId = (key: string) => {
    const id = sources.find(source => source.catalogKey === key)?.id;
    if (!id) throw new Error(`공식 출처 시드를 찾을 수 없습니다: ${key}`);
    return id;
  };
  const documents = [
    { catalogKey: "2022-science-curriculum", sourceId: sourceId("moe-2022-curriculum"), title: "2022 개정 교육과정 과학과 교육과정", subject: "화학", unit: "공통", applicableYear: "2025~2027 적용", documentType: "curriculum" as const, officialUrl: OFFICIAL_SOURCE_SEEDS[0].listingUrl, issueNumber: "교육부 고시 제2022-33호 · 별책 9", publishedAt: "2022-12-22", appliesFrom: "2025-03-01", appliesTo: "2027-02-28", rightsStatus: "link_only" as const, catalogStatus: "published" as const, summary: "2022 개정 교육과정의 과학과 교육과정입니다. 고등학교 1학년부터 순차 적용되는 과학과의 공식 기준 문서입니다." },
    { catalogKey: "2022-science-selective-curriculum", sourceId: sourceId("moe-2022-curriculum"), title: "2022 개정 과학 계열 선택 과목 교육과정", subject: "화학", unit: "공통", applicableYear: "2025~2027 적용", documentType: "curriculum" as const, officialUrl: OFFICIAL_SOURCE_SEEDS[0].listingUrl, issueNumber: "교육부 고시 제2022-33호 · 별책 20", publishedAt: "2022-12-22", appliesFrom: "2025-03-01", appliesTo: "2027-02-28", rightsStatus: "link_only" as const, catalogStatus: "published" as const, summary: "2022 개정 교육과정의 과학 계열 선택 과목 공식 기준입니다. 현재 교육과정의 화학 과목을 확인할 때 사용합니다." },
    { catalogKey: "2015-chemistry-one-curriculum", sourceId: sourceId("moe-2015-curriculum"), title: "2015 개정 교육과정 과학과 교육과정 · 화학 I", subject: "화학 I", unit: "공통", applicableYear: "2026 고등학교 3학년 적용", documentType: "curriculum" as const, officialUrl: OFFICIAL_SOURCE_SEEDS[2].listingUrl, issueNumber: "교육부 고시 제2015-74호 · 별책 9", publishedAt: "2015-09-23", appliesFrom: "2018-03-01", appliesTo: "2027-02-28", rightsStatus: "link_only" as const, catalogStatus: "published" as const, summary: "화학 I 시험 범위 확인을 위한 2015 개정 과학과 교육과정 공식 고시입니다. 2026년 고등학교 3학년 운영 자료로 구분해 제공합니다." },
    { catalogKey: "ncic-2022-original-index", sourceId: sourceId("ncic-curriculum"), title: "NCIC 2022 개정 교육과정 원문 및 해설서", subject: "화학", unit: "공통", applicableYear: "2025~2027 적용", documentType: "achievement_standard" as const, officialUrl: OFFICIAL_SOURCE_SEEDS[1].listingUrl, issueNumber: "NCIC 원문 인벤토리", publishedAt: "2022-12", appliesFrom: "2025-03-01", appliesTo: null, rightsStatus: "link_only" as const, catalogStatus: "published" as const, summary: "국가교육과정정보센터에서 과목별 원문과 해설서를 탐색할 수 있는 공식 인벤토리입니다." },
    { catalogKey: "2022-middle-science-curriculum", sourceId: sourceId("moe-2022-curriculum"), title: "2022 개정 교육과정 · 중등 과학", subject: "중등 과학", unit: "공통", applicableYear: "2025~2027 적용", documentType: "curriculum" as const, officialUrl: OFFICIAL_SOURCE_SEEDS[0].listingUrl, issueNumber: "교육부 고시 제2022-33호 · 별책 9", publishedAt: "2022-12-22", appliesFrom: "2025-03-01", appliesTo: null, rightsStatus: "link_only" as const, catalogStatus: "published" as const, summary: "중학교 과학의 성취기준과 내용 체계를 확인하는 2022 개정 과학과 교육과정 공식 문서입니다.", isDefault: 0 },
    { catalogKey: "2022-middle-mathematics-curriculum", sourceId: sourceId("moe-2022-curriculum"), title: "2022 개정 교육과정 · 중등 수학", subject: "중등 수학", unit: "공통", applicableYear: "2025~2027 적용", documentType: "curriculum" as const, officialUrl: OFFICIAL_SOURCE_SEEDS[0].listingUrl, issueNumber: "교육부 고시 제2022-33호 · 별책 8", publishedAt: "2022-12-22", appliesFrom: "2025-03-01", appliesTo: null, rightsStatus: "link_only" as const, catalogStatus: "published" as const, summary: "중학교 수학의 성취기준과 내용 체계를 확인하는 2022 개정 수학과 교육과정 공식 문서입니다.", isDefault: 0 },
    { catalogKey: "2022-high-integrated-science-one", sourceId: sourceId("moe-2022-curriculum"), title: "2022 개정 교육과정 · 통합과학1", subject: "통합과학1", unit: "공통", applicableYear: "2025~2027 적용", documentType: "curriculum" as const, officialUrl: OFFICIAL_SOURCE_SEEDS[0].listingUrl, issueNumber: "교육부 고시 제2022-33호 · 별책 9", publishedAt: "2022-12-22", appliesFrom: "2025-03-01", appliesTo: null, rightsStatus: "link_only" as const, catalogStatus: "published" as const, summary: "고등학교 과학 공통 과목 통합과학1의 내용 체계와 성취기준을 확인하는 공식 문서입니다.", isDefault: 0 },
    { catalogKey: "2022-high-integrated-science-two", sourceId: sourceId("moe-2022-curriculum"), title: "2022 개정 교육과정 · 통합과학2", subject: "통합과학2", unit: "공통", applicableYear: "2025~2027 적용", documentType: "curriculum" as const, officialUrl: OFFICIAL_SOURCE_SEEDS[0].listingUrl, issueNumber: "교육부 고시 제2022-33호 · 별책 9", publishedAt: "2022-12-22", appliesFrom: "2025-03-01", appliesTo: null, rightsStatus: "link_only" as const, catalogStatus: "published" as const, summary: "고등학교 과학 공통 과목 통합과학2의 내용 체계와 성취기준을 확인하는 공식 문서입니다.", isDefault: 0 },
    { catalogKey: "2022-high-science-inquiry-one", sourceId: sourceId("moe-2022-curriculum"), title: "2022 개정 교육과정 · 과학탐구실험1", subject: "과학탐구실험1", unit: "공통", applicableYear: "2025~2027 적용", documentType: "curriculum" as const, officialUrl: OFFICIAL_SOURCE_SEEDS[0].listingUrl, issueNumber: "교육부 고시 제2022-33호 · 별책 9", publishedAt: "2022-12-22", appliesFrom: "2025-03-01", appliesTo: null, rightsStatus: "link_only" as const, catalogStatus: "published" as const, summary: "고등학교 과학 공통 과목 과학탐구실험1의 탐구·실험 성취기준을 확인하는 공식 문서입니다.", isDefault: 0 },
    { catalogKey: "2022-high-science-inquiry-two", sourceId: sourceId("moe-2022-curriculum"), title: "2022 개정 교육과정 · 과학탐구실험2", subject: "과학탐구실험2", unit: "공통", applicableYear: "2025~2027 적용", documentType: "curriculum" as const, officialUrl: OFFICIAL_SOURCE_SEEDS[0].listingUrl, issueNumber: "교육부 고시 제2022-33호 · 별책 9", publishedAt: "2022-12-22", appliesFrom: "2025-03-01", appliesTo: null, rightsStatus: "link_only" as const, catalogStatus: "published" as const, summary: "고등학교 과학 공통 과목 과학탐구실험2의 탐구·실험 성취기준을 확인하는 공식 문서입니다.", isDefault: 0 },
    { catalogKey: "2022-high-physics-curriculum", sourceId: sourceId("moe-2022-curriculum"), title: "2022 개정 교육과정 · 물리학", subject: "물리학", unit: "공통", applicableYear: "2025~2027 적용", documentType: "curriculum" as const, officialUrl: OFFICIAL_SOURCE_SEEDS[0].listingUrl, issueNumber: "교육부 고시 제2022-33호 · 별책 9·20", publishedAt: "2022-12-22", appliesFrom: "2025-03-01", appliesTo: null, rightsStatus: "link_only" as const, catalogStatus: "published" as const, summary: "고등학교 과학 일반 선택 물리학과 과학 계열 선택 과목 기준을 확인하는 공식 문서입니다.", isDefault: 0 },
    { catalogKey: "2022-high-chemistry-curriculum", sourceId: sourceId("moe-2022-curriculum"), title: "2022 개정 교육과정 · 화학", subject: "화학", unit: "공통", applicableYear: "2025~2027 적용", documentType: "curriculum" as const, officialUrl: OFFICIAL_SOURCE_SEEDS[0].listingUrl, issueNumber: "교육부 고시 제2022-33호 · 별책 9·20", publishedAt: "2022-12-22", appliesFrom: "2025-03-01", appliesTo: null, rightsStatus: "link_only" as const, catalogStatus: "published" as const, summary: "고등학교 과학 일반 선택 화학과 과학 계열 선택 과목 기준을 확인하는 공식 문서입니다.", isDefault: 0 },
    { catalogKey: "2022-high-life-science-curriculum", sourceId: sourceId("moe-2022-curriculum"), title: "2022 개정 교육과정 · 생명과학", subject: "생명과학", unit: "공통", applicableYear: "2025~2027 적용", documentType: "curriculum" as const, officialUrl: OFFICIAL_SOURCE_SEEDS[0].listingUrl, issueNumber: "교육부 고시 제2022-33호 · 별책 9·20", publishedAt: "2022-12-22", appliesFrom: "2025-03-01", appliesTo: null, rightsStatus: "link_only" as const, catalogStatus: "published" as const, summary: "고등학교 과학 일반 선택 생명과학과 과학 계열 선택 과목 기준을 확인하는 공식 문서입니다.", isDefault: 0 },
    { catalogKey: "2022-high-earth-science-curriculum", sourceId: sourceId("moe-2022-curriculum"), title: "2022 개정 교육과정 · 지구과학", subject: "지구과학", unit: "공통", applicableYear: "2025~2027 적용", documentType: "curriculum" as const, officialUrl: OFFICIAL_SOURCE_SEEDS[0].listingUrl, issueNumber: "교육부 고시 제2022-33호 · 별책 9·20", publishedAt: "2022-12-22", appliesFrom: "2025-03-01", appliesTo: null, rightsStatus: "link_only" as const, catalogStatus: "published" as const, summary: "고등학교 과학 일반 선택 지구과학과 과학 계열 선택 과목 기준을 확인하는 공식 문서입니다.", isDefault: 0 },
    { catalogKey: "2022-high-common-mathematics-one", sourceId: sourceId("moe-2022-curriculum"), title: "2022 개정 교육과정 · 공통수학1", subject: "공통수학1", unit: "공통", applicableYear: "2025~2027 적용", documentType: "curriculum" as const, officialUrl: OFFICIAL_SOURCE_SEEDS[0].listingUrl, issueNumber: "교육부 고시 제2022-33호 · 별책 8", publishedAt: "2022-12-22", appliesFrom: "2025-03-01", appliesTo: null, rightsStatus: "link_only" as const, catalogStatus: "published" as const, summary: "고등학교 수학 공통 과목 공통수학1의 성취기준과 내용 체계를 확인하는 공식 문서입니다.", isDefault: 0 },
    { catalogKey: "2022-high-common-mathematics-two", sourceId: sourceId("moe-2022-curriculum"), title: "2022 개정 교육과정 · 공통수학2", subject: "공통수학2", unit: "공통", applicableYear: "2025~2027 적용", documentType: "curriculum" as const, officialUrl: OFFICIAL_SOURCE_SEEDS[0].listingUrl, issueNumber: "교육부 고시 제2022-33호 · 별책 8", publishedAt: "2022-12-22", appliesFrom: "2025-03-01", appliesTo: null, rightsStatus: "link_only" as const, catalogStatus: "published" as const, summary: "고등학교 수학 공통 과목 공통수학2의 성취기준과 내용 체계를 확인하는 공식 문서입니다.", isDefault: 0 },
  ];
  for (const document of documents) {
    await db.insert(officialDocuments).values(document).onDuplicateKeyUpdate({ set: { title: document.title, applicableYear: document.applicableYear, officialUrl: document.officialUrl, summary: document.summary, lastVerifiedAt: new Date() } });
  }
}

export async function listOfficialDocuments(subject?: string) {
  await ensureOfficialCatalog();
  const db = await requireDb();
  const query = db.select({ document: officialDocuments, source: officialSources }).from(officialDocuments).innerJoin(officialSources, eq(officialDocuments.sourceId, officialSources.id)).where(eq(officialDocuments.catalogStatus, "published"));
  const rows = await query.orderBy(desc(officialDocuments.appliesFrom));
  return subject ? rows.filter(row => row.document.subject === subject) : rows;
}

export async function listOfficialDocumentsForUser(userId: number, subject?: string) {
  const documents = await listOfficialDocuments(subject);
  const db = await requireDb();
  const selections = await db.select().from(officialDocumentSelections).where(eq(officialDocumentSelections.userId, userId));
  const selectionMap = new Map(selections.map(selection => [selection.documentId, selection.useForGeneration === 1]));
  return documents.map(row => ({ ...row, useForGeneration: selectionMap.get(row.document.id) ?? row.document.isDefault === 1 }));
}

export async function setOfficialDocumentSelection(userId: number, documentId: number, useForGeneration: boolean) {
  const db = await requireDb();
  const document = (await db.select().from(officialDocuments).where(eq(officialDocuments.id, documentId)).limit(1))[0];
  if (!document || document.catalogStatus !== "published") throw new Error("사용할 수 있는 공식 문서를 찾을 수 없습니다.");
  const existing = (await db.select().from(officialDocumentSelections).where(and(eq(officialDocumentSelections.userId, userId), eq(officialDocumentSelections.documentId, documentId))).limit(1))[0];
  if (existing) await db.update(officialDocumentSelections).set({ useForGeneration: useForGeneration ? 1 : 0 }).where(eq(officialDocumentSelections.id, existing.id));
  else await db.insert(officialDocumentSelections).values({ userId, documentId, useForGeneration: useForGeneration ? 1 : 0 });
}

export async function getSelectedOfficialDocumentsForGeneration(userId: number, subject: string) {
  const documents = await listOfficialDocumentsForUser(userId, subject);
  return documents.filter(row => row.useForGeneration);
}

export async function listOfficialSources() {
  await ensureOfficialCatalog();
  const db = await requireDb();
  return db.select().from(officialSources).orderBy(desc(officialSources.updatedAt));
}

export async function createOfficialSource(values: Omit<typeof officialSources.$inferInsert, "id" | "createdAt" | "updatedAt" | "lastFingerprint" | "lastCheckedAt" | "lastCheckStatus">) {
  const db = await requireDb();
  const result = await db.insert(officialSources).values(values);
  return Number(result[0].insertId);
}

export async function listEnabledOfficialSources() {
  const db = await requireDb();
  return db.select().from(officialSources).where(eq(officialSources.enabled, 1));
}

export async function getOfficialSource(id: number) {
  const db = await requireDb();
  return (await db.select().from(officialSources).where(eq(officialSources.id, id)).limit(1))[0];
}

export async function updateOfficialSourceCheck(id: number, values: { lastFingerprint?: string; lastCheckedAt: Date; lastCheckStatus: string }) {
  const db = await requireDb();
  await db.update(officialSources).set(values).where(eq(officialSources.id, id));
}

export async function createOfficialSourceChange(values: typeof officialSourceChanges.$inferInsert) {
  const db = await requireDb();
  const existing = await db.select().from(officialSourceChanges).where(and(eq(officialSourceChanges.sourceId, values.sourceId), eq(officialSourceChanges.fingerprint, values.fingerprint), eq(officialSourceChanges.status, "pending"))).limit(1);
  if (!existing.length) await db.insert(officialSourceChanges).values(values);
}

export async function listOfficialSourceChanges() {
  const db = await requireDb();
  return db.select({ change: officialSourceChanges, source: officialSources }).from(officialSourceChanges).innerJoin(officialSources, eq(officialSourceChanges.sourceId, officialSources.id)).orderBy(desc(officialSourceChanges.detectedAt));
}

export async function reviewOfficialSourceChange(id: number, reviewerId: number, status: "approved" | "rejected", reviewNote: string) {
  const db = await requireDb();
  const change = (await db.select().from(officialSourceChanges).where(eq(officialSourceChanges.id, id)).limit(1))[0];
  if (!change) throw new Error("변경 후보를 찾을 수 없습니다.");
  if (change.status !== "pending") throw new Error("이미 검토가 완료된 변경 후보입니다.");
  const reviewedAt = new Date();
  await db.update(officialSourceChanges).set({ status, reviewedBy: reviewerId, reviewNote, reviewedAt }).where(eq(officialSourceChanges.id, id));
  if (status === "approved") {
    const sourceDocuments = await db.select().from(officialDocuments).where(eq(officialDocuments.sourceId, change.sourceId));
    if (sourceDocuments.length) {
      await db.insert(officialDocuments).values(sourceDocuments.map(document => buildApprovedOfficialDocumentVersion(document, change, reviewNote, reviewedAt))).onDuplicateKeyUpdate({ set: { officialUrl: change.documentUrl, summary: `공식 출처 변경 확인: ${change.title}. 관리자 검토: ${reviewNote}`, sourceSnapshot: change.snapshot, lastVerifiedAt: reviewedAt, catalogStatus: "published" } });
    } else {
      await db.insert(officialDocuments).values({
        catalogKey: `source-${change.sourceId}-change-${change.id}`,
        sourceId: change.sourceId,
        title: change.title.replace(" 페이지 변경 후보", ""),
        subject: "화학 I",
        unit: "공통",
        applicableYear: "관리자 확인 후 적용",
        documentType: "guideline",
        officialUrl: change.documentUrl,
        rightsStatus: "link_only",
        catalogStatus: "published",
        summary: `공식 출처 변경 후보를 관리자 검토 후 반영한 문서입니다. ${reviewNote}`,
        sourceSnapshot: change.snapshot,
        lastVerifiedAt: reviewedAt,
      });
    }
  }
  const [applied] = status === "approved" ? await db.select({ value: count() }).from(officialDocuments).where(eq(officialDocuments.sourceId, change.sourceId)) : [{ value: 0 }];
  return { appliedDocumentCount: Number(applied.value) };
}
