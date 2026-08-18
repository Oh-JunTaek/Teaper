import {
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["teacher", "admin"]).default("teacher").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const referenceMaterials = mysqlTable(
  "reference_materials",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 80 }).notNull(),
    unit: varchar("unit", { length: 120 }).notNull(),
    applicableYear: varchar("applicableYear", { length: 20 }).notNull(),
    materialType: mysqlEnum("materialType", ["curriculum", "textbook", "guideline", "teaching", "other"]).notNull(),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    mimeType: varchar("mimeType", { length: 120 }).notNull(),
    fileKey: text("fileKey").notNull(),
    fileUrl: text("fileUrl").notNull(),
    sourceLocation: varchar("sourceLocation", { length: 255 }),
    sourceText: text("sourceText"),
    ocrText: text("ocrText"),
    ocrStructure: json("ocrStructure"),
    ocrStatus: mysqlEnum("ocrStatus", ["not_required", "pending", "completed", "failed"]).default("not_required").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  table => [index("reference_materials_subject_unit_idx").on(table.subject, table.unit)],
);

export const materialChunks = mysqlTable(
  "material_chunks",
  {
    id: int("id").autoincrement().primaryKey(),
    materialId: int("materialId").notNull(),
    chunkIndex: int("chunkIndex").notNull(),
    content: text("content").notNull(),
    embedding: json("embedding").$type<number[]>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("material_chunks_material_idx").on(table.materialId)],
);

export const referenceQuestions = mysqlTable(
  "reference_questions",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    subject: varchar("subject", { length: 80 }).notNull(),
    unit: varchar("unit", { length: 120 }).notNull(),
    questionType: varchar("questionType", { length: 80 }).notNull(),
    difficulty: varchar("difficulty", { length: 30 }).notNull(),
    points: int("points").notNull(),
    year: varchar("year", { length: 20 }).notNull(),
    source: varchar("source", { length: 160 }).notNull(),
    questionNumber: varchar("questionNumber", { length: 60 }),
    sourceLocation: varchar("sourceLocation", { length: 255 }),
    questionText: text("questionText").notNull(),
    choices: json("choices").$type<string[]>(),
    answer: text("answer").notNull(),
    explanation: text("explanation").notNull(),
    intent: text("intent").notNull(),
    embedding: json("embedding").$type<number[]>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("reference_questions_subject_unit_idx").on(table.subject, table.unit)],
);

export const generationRequests = mysqlTable("generation_requests", {
  id: int("id").autoincrement().primaryKey(),
  requesterId: int("requesterId").notNull(),
  providerType: mysqlEnum("providerType", ["managed", "ollama", "openai_compatible", "gemini"]).default("managed").notNull(),
  providerSettingId: int("providerSettingId"),
  providerModel: varchar("providerModel", { length: 160 }).notNull().default("managed-default"),
  externalTransferConsentAt: timestamp("externalTransferConsentAt"),
  subject: varchar("subject", { length: 80 }).notNull(),
  unit: varchar("unit", { length: 120 }).notNull(),
  difficulty: varchar("difficulty", { length: 30 }).notNull(),
  questionType: varchar("questionType", { length: 80 }).notNull(),
  points: int("points").notNull(),
  questionCount: int("questionCount").notNull(),
  additionalRequirements: text("additionalRequirements"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const aiProviderSettings = mysqlTable(
  "ai_provider_settings",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    providerType: mysqlEnum("providerType", ["managed", "ollama", "openai_compatible", "gemini"]).notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    baseUrl: varchar("baseUrl", { length: 500 }),
    model: varchar("model", { length: 160 }).notNull(),
    encryptedApiKey: text("encryptedApiKey"),
    apiKeyHint: varchar("apiKeyHint", { length: 16 }),
    allowExternalTransfer: int("allowExternalTransfer").default(0).notNull(),
    externalTransferConsentAt: timestamp("externalTransferConsentAt"),
    enabled: int("enabled").default(1).notNull(),
    lastVerifiedAt: timestamp("lastVerifiedAt"),
    lastVerificationStatus: varchar("lastVerificationStatus", { length: 40 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("ai_provider_settings_user_idx").on(table.userId, table.providerType)],
);

export const generatedQuestions = mysqlTable(
  "generated_questions",
  {
    id: int("id").autoincrement().primaryKey(),
    requestId: int("requestId").notNull(),
    creatorId: int("creatorId").notNull(),
    questionText: text("questionText").notNull(),
    choices: json("choices").$type<string[]>(),
    answer: text("answer").notNull(),
    explanation: text("explanation").notNull(),
    intent: text("intent").notNull(),
    difficulty: varchar("difficulty", { length: 30 }).notNull(),
    points: int("points").notNull(),
    questionType: varchar("questionType", { length: 80 }).notNull(),
    usedConcepts: json("usedConcepts").$type<string[]>(),
    validationReport: json("validationReport"),
    model: varchar("model", { length: 120 }).notNull(),
    promptVersion: varchar("promptVersion", { length: 80 }).notNull(),
    status: mysqlEnum("status", ["pending_review", "approved", "revised", "rejected", "validation_hold"]).default("pending_review").notNull(),
    reviewedBy: int("reviewedBy"),
    reviewReason: text("reviewReason"),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("generated_questions_status_idx").on(table.status)],
);

export const generatedQuestionSources = mysqlTable(
  "generated_question_sources",
  {
    id: int("id").autoincrement().primaryKey(),
    generatedQuestionId: int("generatedQuestionId").notNull(),
    sourceType: mysqlEnum("sourceType", ["material", "reference_question", "guideline"]).notNull(),
    sourceId: int("sourceId").notNull(),
    excerpt: text("excerpt"),
    sourceSnapshot: json("sourceSnapshot"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("generated_question_sources_question_idx").on(table.generatedQuestionId)],
);

export const reviewEvents = mysqlTable(
  "review_events",
  {
    id: int("id").autoincrement().primaryKey(),
    generatedQuestionId: int("generatedQuestionId").notNull(),
    reviewerId: int("reviewerId").notNull(),
    action: mysqlEnum("action", ["approved", "revised", "rejected"]).notNull(),
    reason: text("reason"),
    beforeSnapshot: json("beforeSnapshot"),
    afterSnapshot: json("afterSnapshot"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("review_events_question_idx").on(table.generatedQuestionId)],
);

export const officialSources = mysqlTable(
  "official_sources",
  {
    id: int("id").autoincrement().primaryKey(),
    catalogKey: varchar("catalogKey", { length: 100 }).notNull().unique(),
    provider: varchar("provider", { length: 160 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    sourceType: mysqlEnum("sourceType", ["ministry", "curriculum_center", "education_office"]).notNull(),
    listingUrl: text("listingUrl").notNull(),
    allowedUse: mysqlEnum("allowedUse", ["link_only", "metadata_only", "approved_for_rag"]).default("link_only").notNull(),
    enabled: int("enabled").default(1).notNull(),
    lastFingerprint: varchar("lastFingerprint", { length: 128 }),
    lastCheckedAt: timestamp("lastCheckedAt"),
    lastCheckStatus: varchar("lastCheckStatus", { length: 40 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("official_sources_enabled_idx").on(table.enabled)],
);

export const officialDocuments = mysqlTable(
  "official_documents",
  {
    id: int("id").autoincrement().primaryKey(),
    catalogKey: varchar("catalogKey", { length: 100 }).notNull().unique(),
    sourceId: int("sourceId").notNull(),
    previousDocumentId: int("previousDocumentId"),
    title: varchar("title", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 80 }).notNull(),
    unit: varchar("unit", { length: 120 }).notNull(),
    applicableYear: varchar("applicableYear", { length: 40 }).notNull(),
    documentType: mysqlEnum("documentType", ["curriculum", "guideline", "achievement_standard"]).notNull(),
    officialUrl: text("officialUrl").notNull(),
    issueNumber: varchar("issueNumber", { length: 100 }),
    publishedAt: varchar("publishedAt", { length: 30 }),
    appliesFrom: varchar("appliesFrom", { length: 30 }),
    appliesTo: varchar("appliesTo", { length: 30 }),
    rightsStatus: mysqlEnum("rightsStatus", ["link_only", "rights_review", "approved_for_rag"]).default("link_only").notNull(),
    catalogStatus: mysqlEnum("catalogStatus", ["published", "pending_review", "archived"]).default("published").notNull(),
    summary: text("summary").notNull(),
    sourceSnapshot: json("sourceSnapshot"),
    isDefault: int("isDefault").default(1).notNull(),
    lastVerifiedAt: timestamp("lastVerifiedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("official_documents_subject_idx").on(table.subject, table.catalogStatus)],
);

export const officialSourceChanges = mysqlTable(
  "official_source_changes",
  {
    id: int("id").autoincrement().primaryKey(),
    sourceId: int("sourceId").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    documentUrl: text("documentUrl").notNull(),
    reason: varchar("reason", { length: 255 }).notNull(),
    fingerprint: varchar("fingerprint", { length: 128 }).notNull(),
    snapshot: json("snapshot"),
    status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
    reviewedBy: int("reviewedBy"),
    reviewNote: text("reviewNote"),
    reviewedAt: timestamp("reviewedAt"),
    detectedAt: timestamp("detectedAt").defaultNow().notNull(),
  },
  table => [index("official_source_changes_source_idx").on(table.sourceId, table.status)],
);

export const officialDocumentSelections = mysqlTable(
  "official_document_selections",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    documentId: int("documentId").notNull(),
    useForGeneration: int("useForGeneration").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("official_document_selections_user_idx").on(table.userId, table.documentId)],
);

export const generationOfficialDocuments = mysqlTable(
  "generation_official_documents",
  {
    id: int("id").autoincrement().primaryKey(),
    requestId: int("requestId").notNull(),
    documentId: int("documentId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("generation_official_documents_request_idx").on(table.requestId, table.documentId)],
);

export const referenceQuestionSelections = mysqlTable(
  "reference_question_selections",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    referenceQuestionId: int("referenceQuestionId").notNull(),
    useForGeneration: int("useForGeneration").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("reference_question_selections_user_idx").on(table.userId, table.referenceQuestionId)],
);

export const generationReferenceQuestions = mysqlTable(
  "generation_reference_questions",
  {
    id: int("id").autoincrement().primaryKey(),
    requestId: int("requestId").notNull(),
    referenceQuestionId: int("referenceQuestionId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("generation_reference_questions_request_idx").on(table.requestId, table.referenceQuestionId)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
