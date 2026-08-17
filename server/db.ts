import { and, count, desc, eq, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  generatedQuestions,
  generatedQuestionSources,
  generationOfficialDocuments,
  generationRequests,
  InsertUser,
  materialChunks,
  officialDocumentSelections,
  officialDocuments,
  officialSourceChanges,
  officialSources,
  referenceMaterials,
  referenceQuestions,
  reviewEvents,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { buildApprovedOfficialDocumentVersion } from "./services/officialCatalogVersion";

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

export async function createMaterial(values: typeof referenceMaterials.$inferInsert) {
  const db = await requireDb();
  const result = await db.insert(referenceMaterials).values(values);
  return Number(result[0].insertId);
}

export async function getMaterial(id: number) {
  const db = await requireDb();
  return (await db.select().from(referenceMaterials).where(eq(referenceMaterials.id, id)).limit(1))[0];
}

export async function listMaterials() {
  const db = await requireDb();
  return db.select().from(referenceMaterials).orderBy(desc(referenceMaterials.createdAt));
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

export async function listReferenceQuestions() {
  const db = await requireDb();
  return db.select().from(referenceQuestions).orderBy(desc(referenceQuestions.createdAt));
}

export async function updateReferenceQuestion(id: number, values: Omit<typeof referenceQuestions.$inferInsert, "id" | "ownerId" | "createdAt" | "updatedAt">) {
  const db = await requireDb();
  await db.update(referenceQuestions).set(values).where(eq(referenceQuestions.id, id));
}

export async function getReferenceQuestionsForRag(subject: string, unit: string) {
  const db = await requireDb();
  return db.select().from(referenceQuestions).where(and(eq(referenceQuestions.subject, subject), or(eq(referenceQuestions.unit, unit), eq(referenceQuestions.unit, "공통"))));
}

export async function getMaterialChunksForRag(subject: string, unit: string) {
  const db = await requireDb();
  return db
    .select({ chunk: materialChunks, material: referenceMaterials })
    .from(materialChunks)
    .innerJoin(referenceMaterials, eq(materialChunks.materialId, referenceMaterials.id))
    .where(and(eq(referenceMaterials.subject, subject), or(eq(referenceMaterials.unit, unit), eq(referenceMaterials.unit, "공통"))));
}

export async function createGenerationRequest(values: typeof generationRequests.$inferInsert, officialDocumentIds: number[] = []) {
  const db = await requireDb();
  const result = await db.insert(generationRequests).values(values);
  const requestId = Number(result[0].insertId);
  if (officialDocumentIds.length) {
    await db.insert(generationOfficialDocuments).values(Array.from(new Set(officialDocumentIds)).map(documentId => ({ requestId, documentId })));
  }
  return requestId;
}

export async function createGeneratedQuestion(values: typeof generatedQuestions.$inferInsert, sources: Array<{ sourceType: "material" | "reference_question" | "guideline"; sourceId: number; excerpt?: string }>) {
  const db = await requireDb();
  const result = await db.insert(generatedQuestions).values(values);
  const questionId = Number(result[0].insertId);
  if (sources.length) {
    await db.insert(generatedQuestionSources).values(sources.map(source => ({ generatedQuestionId: questionId, ...source })));
  }
  return questionId;
}

export async function listGeneratedQuestions(status?: "pending_review" | "approved" | "revised" | "rejected" | "validation_hold") {
  const db = await requireDb();
  const query = db.select().from(generatedQuestions);
  return status ? query.where(eq(generatedQuestions.status, status)).orderBy(desc(generatedQuestions.createdAt)) : query.orderBy(desc(generatedQuestions.createdAt));
}

export async function getGeneratedQuestionDetail(id: number) {
  const db = await requireDb();
  const question = (await db.select().from(generatedQuestions).where(eq(generatedQuestions.id, id)).limit(1))[0];
  if (!question) return undefined;
  const sources = await db.select().from(generatedQuestionSources).where(eq(generatedQuestionSources.generatedQuestionId, id));
  const events = await db.select().from(reviewEvents).where(eq(reviewEvents.generatedQuestionId, id)).orderBy(desc(reviewEvents.createdAt));
  const officialDocumentLinks = await db.select({ document: officialDocuments, source: officialSources }).from(generationOfficialDocuments).innerJoin(officialDocuments, eq(generationOfficialDocuments.documentId, officialDocuments.id)).innerJoin(officialSources, eq(officialDocuments.sourceId, officialSources.id)).where(eq(generationOfficialDocuments.requestId, question.requestId));
  const materialIds = sources.filter(s => s.sourceType === "material" || s.sourceType === "guideline").map(s => s.sourceId);
  const referenceIds = sources.filter(s => s.sourceType === "reference_question").map(s => s.sourceId);
  const materials = materialIds.length ? await db.select().from(referenceMaterials).where(or(...materialIds.map(item => eq(referenceMaterials.id, item)))) : [];
  const references = referenceIds.length ? await db.select().from(referenceQuestions).where(or(...referenceIds.map(item => eq(referenceQuestions.id, item)))) : [];
  return { question, sources, events, materials, references, officialDocuments: officialDocumentLinks };
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

export async function dashboardStats() {
  await ensureOfficialCatalog();
  const db = await requireDb();
  const [materialCount] = await db.select({ value: count() }).from(referenceMaterials);
  const [referenceCount] = await db.select({ value: count() }).from(referenceQuestions);
  const [reviewCount] = await db.select({ value: count() }).from(generatedQuestions).where(eq(generatedQuestions.status, "pending_review"));
  const [approvedCount] = await db.select({ value: count() }).from(generatedQuestions).where(eq(generatedQuestions.status, "approved"));
  const [officialDocumentCount] = await db.select({ value: count() }).from(officialDocuments).where(eq(officialDocuments.catalogStatus, "published"));
  return { materialCount: Number(materialCount.value), referenceCount: Number(referenceCount.value), reviewCount: Number(reviewCount.value), approvedCount: Number(approvedCount.value), officialDocumentCount: Number(officialDocumentCount.value) };
}

export async function listWorkspaceUsers() {
  const db = await requireDb();
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, lastSignedIn: users.lastSignedIn }).from(users).orderBy(desc(users.lastSignedIn));
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
