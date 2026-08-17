import { and, count, desc, eq, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  generatedQuestions,
  generatedQuestionSources,
  generationRequests,
  InsertUser,
  materialChunks,
  referenceMaterials,
  referenceQuestions,
  reviewEvents,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

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

export async function createGenerationRequest(values: typeof generationRequests.$inferInsert) {
  const db = await requireDb();
  const result = await db.insert(generationRequests).values(values);
  return Number(result[0].insertId);
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
  const materialIds = sources.filter(s => s.sourceType === "material" || s.sourceType === "guideline").map(s => s.sourceId);
  const referenceIds = sources.filter(s => s.sourceType === "reference_question").map(s => s.sourceId);
  const materials = materialIds.length ? await db.select().from(referenceMaterials).where(or(...materialIds.map(item => eq(referenceMaterials.id, item)))) : [];
  const references = referenceIds.length ? await db.select().from(referenceQuestions).where(or(...referenceIds.map(item => eq(referenceQuestions.id, item)))) : [];
  return { question, sources, events, materials, references };
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
  const db = await requireDb();
  const [materialCount] = await db.select({ value: count() }).from(referenceMaterials);
  const [referenceCount] = await db.select({ value: count() }).from(referenceQuestions);
  const [reviewCount] = await db.select({ value: count() }).from(generatedQuestions).where(eq(generatedQuestions.status, "pending_review"));
  const [approvedCount] = await db.select({ value: count() }).from(generatedQuestions).where(eq(generatedQuestions.status, "approved"));
  return { materialCount: Number(materialCount.value), referenceCount: Number(referenceCount.value), reviewCount: Number(reviewCount.value), approvedCount: Number(approvedCount.value) };
}

export async function listWorkspaceUsers() {
  const db = await requireDb();
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, lastSignedIn: users.lastSignedIn }).from(users).orderBy(desc(users.lastSignedIn));
}

export async function setWorkspaceUserRole(userId: number, role: "teacher" | "admin") {
  const db = await requireDb();
  await db.update(users).set({ role }).where(eq(users.id, userId));
}
