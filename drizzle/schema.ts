import {
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["teacher", "admin"]).default("teacher").notNull(),
  // 플랜은 관리자 역할과 독립적으로 기능 접근만 제어합니다. 실제 결제 정보는 아직 저장하지 않습니다.
  membershipPlan: mysqlEnum("membershipPlan", ["basic", "plus"]).default("basic").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// 관리형 AI의 운영 규모만 확인하는 일별 합계입니다. 사용자 ID·IP·프롬프트·문항·원문은 저장하지 않습니다.
export const managedAiUsageDaily = mysqlTable(
  "managed_ai_usage_daily",
  {
    id: int("id").autoincrement().primaryKey(),
    usageDate: varchar("usageDate", { length: 10 }).notNull(),
    operation: mysqlEnum("operation", ["generation", "validation", "vision_extract"]).notNull(),
    outcome: mysqlEnum("outcome", ["success", "failure", "limited"]).notNull(),
    model: varchar("model", { length: 160 }).notNull(),
    durationBucket: mysqlEnum("durationBucket", ["under_5s", "5_to_15s", "15_to_45s", "over_45s"]).notNull(),
    callCount: int("callCount").default(0).notNull(),
    knownInputTokens: int("knownInputTokens").default(0).notNull(),
    knownOutputTokens: int("knownOutputTokens").default(0).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("managed_ai_usage_daily_unique").on(table.usageDate, table.operation, table.outcome, table.model, table.durationBucket),
    index("managed_ai_usage_daily_date_idx").on(table.usageDate),
  ],
);

// 플랜별 포함량을 확인하는 월간 성공 작업 카운터입니다. 프롬프트·문항·파일명·IP·이미지 원본은 저장하지 않습니다.
export const managedAiMonthlySuccess = mysqlTable(
  "managed_ai_monthly_success",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    usageMonth: varchar("usageMonth", { length: 7 }).notNull(),
    successCount: int("successCount").default(0).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("managed_ai_monthly_success_unique").on(table.ownerId, table.usageMonth),
    index("managed_ai_monthly_success_month_idx").on(table.usageMonth),
  ],
);

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
    sourceFileName: varchar("sourceFileName", { length: 255 }),
    sourceFileKey: text("sourceFileKey"),
    sourceFileUrl: text("sourceFileUrl"),
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
  providerType: mysqlEnum("providerType", ["managed", "ollama", "openai_compatible", "gemini", "anthropic"]).default("managed").notNull(),
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
    providerType: mysqlEnum("providerType", ["managed", "ollama", "openai_compatible", "gemini", "anthropic"]).notNull(),
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

// 교사가 원하는 문항 스타일·검수 관점을 저장합니다. 공통 안전 계약을 대체하지 않는 보조 지시문입니다.
export const userAiPreferences = mysqlTable(
  "user_ai_preferences",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().unique(),
    customInstructions: text("customInstructions").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("user_ai_preferences_user_idx").on(table.userId)],
);

// 교사의 작업 메모는 문항 원문·자료와 분리해 사용자별로만 보관합니다.
export const teacherNotes = mysqlTable(
  "teacher_notes",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    content: text("content").notNull(),
    isPinned: int("isPinned").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  table => [index("teacher_notes_owner_updated_idx").on(table.ownerId, table.updatedAt)],
);

// 일정은 교사별 시험일·마감·회의·검수 계획만 저장하며, 문항 원문이나 자료 본문을 자동으로 연결하지 않습니다.
export const teacherSchedules = mysqlTable(
  "teacher_schedules",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    scheduleDate: varchar("scheduleDate", { length: 10 }).notNull(),
    scheduleTime: varchar("scheduleTime", { length: 5 }),
    eventType: mysqlEnum("eventType", ["exam", "deadline", "meeting", "review", "other"]).default("other").notNull(),
    status: mysqlEnum("status", ["planned", "completed"]).default("planned").notNull(),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  table => [index("teacher_schedules_owner_date_idx").on(table.ownerId, table.scheduleDate, table.status)],
);

// 쪽지시험은 일반 문항 생성 요청과 구분된 짧은 개념 확인 세트로 보관합니다.
export const quickQuizSets = mysqlTable(
  "quick_quiz_sets",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    subject: varchar("subject", { length: 80 }).notNull(),
    unit: varchar("unit", { length: 120 }).notNull(),
    topic: varchar("topic", { length: 160 }).notNull(),
    difficulty: varchar("difficulty", { length: 30 }).notNull(),
    // 기존 세트는 객관식 4지선다로 읽어, 새 형식 도입 뒤에도 학생용 출력 흐름을 유지한다.
    questionFormat: mysqlEnum("questionFormat", ["multiple_choice", "short_answer", "ox"]).default("multiple_choice").notNull(),
    questionCount: int("questionCount").notNull(),
    questions: json("questions").$type<Array<{ questionText: string; choices: string[]; answer: string; explanation: string; concept: string }>>().notNull(),
    // 인덱스별 상태는 questions와 같은 순서를 사용한다. 기존 세트의 null은 모두 검수 대기로 해석한다.
    questionReviewStates: json("questionReviewStates").$type<Array<"pending_review" | "approved" | "revised" | "rejected">>(),
    providerType: varchar("providerType", { length: 40 }).notNull(),
    providerModel: varchar("providerModel", { length: 160 }).notNull(),
    promptVersion: varchar("promptVersion", { length: 80 }).notNull(),
    status: mysqlEnum("status", ["pending_review", "approved", "revised", "rejected"]).default("pending_review").notNull(),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  table => [index("quick_quiz_sets_owner_updated_idx").on(table.ownerId, table.updatedAt)],
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
    visualSpec: json("visualSpec"),
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
    sourceType: mysqlEnum("sourceType", ["ministry", "curriculum_center", "education_office", "evaluation_portal"]).notNull(),
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
