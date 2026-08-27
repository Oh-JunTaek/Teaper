import { DatabaseSync } from "node:sqlite";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { LOCAL_OFFICIAL_DOCUMENTS, documentsForScope } from "./officialCatalog.mjs";

function databasePath() { return process.env.LOCAL_DATA_DB_PATH || join(process.env.LOCAL_APP_DATA_DIR || join(homedir(), ".teacher-assessment-assistant"), "teacher-assessment.sqlite"); }

const QUICK_QUIZ_REVIEW_STATES = ["pending_review", "approved", "revised", "rejected"];
// 이전 세트의 누락된 문항별 상태는 승인으로 간주하지 않아 교사 재검수를 보장한다.
function normalizeQuickQuizQuestionStates(value, questionCount) {
  const count = Math.max(1, Number(questionCount) || 1);
  let states = [];
  try { states = Array.isArray(value) ? value : JSON.parse(value || "[]"); } catch { states = []; }
  return Array.from({ length: count }, (_unused, index) => QUICK_QUIZ_REVIEW_STATES.includes(states[index]) ? states[index] : "pending_review");
}

// 배점은 교사가 정한 0~100점·소수 첫째 자리 값만 보관한다. 과거 세트의 null은 미지정으로 유지한다.
function normalizeQuickQuizQuestionPoints(value, questionCount) {
  const count = Math.max(1, Number(questionCount) || 1);
  let points = [];
  try { points = Array.isArray(value) ? value : JSON.parse(value || "[]"); } catch { points = []; }
  return Array.from({ length: count }, (_unused, index) => {
    if (points[index] === null || points[index] === undefined || points[index] === "") return null;
    const point = Number(points[index]);
    return Number.isFinite(point) && point >= 0 && point <= 100 && Math.round(point * 10) === point * 10 ? point : null;
  });
}

// 세트 상태는 목록 안내용 요약이며, 학생용 출력 권한은 개별 문항의 approved만 사용한다.
function summarizeQuickQuizReview(states) {
  if (states.some(status => status === "pending_review")) return "pending_review";
  if (states.every(status => status === "approved")) return "approved";
  if (states.every(status => status === "rejected")) return "rejected";
  return "revised";
}

export async function openLocalStore() {
  const path = databasePath();
  await mkdir(join(path, ".."), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS reference_materials (id TEXT PRIMARY KEY, title TEXT NOT NULL, subject TEXT NOT NULL, unit TEXT NOT NULL, material_type TEXT NOT NULL, file_path TEXT NOT NULL, content_sha256 TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS material_chunks (id TEXT PRIMARY KEY, material_id TEXT NOT NULL, chunk_index INTEGER NOT NULL, content TEXT NOT NULL, embedding_json TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reference_questions (id TEXT PRIMARY KEY, subject TEXT NOT NULL, unit TEXT NOT NULL, source TEXT NOT NULL, question_number TEXT, question_text TEXT NOT NULL, intent TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS official_documents (catalog_key TEXT PRIMARY KEY, title TEXT NOT NULL, subject TEXT NOT NULL, unit TEXT NOT NULL, applicable_year TEXT NOT NULL, document_type TEXT NOT NULL, official_url TEXT NOT NULL, issue_number TEXT NOT NULL, rights_status TEXT NOT NULL, summary TEXT NOT NULL, cached_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS official_document_selections (catalog_key TEXT PRIMARY KEY, use_for_generation INTEGER NOT NULL DEFAULT 0, selected_at TEXT);
    CREATE TABLE IF NOT EXISTS local_settings (setting_key TEXT PRIMARY KEY, setting_value TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS generation_requests (id TEXT PRIMARY KEY, provider_type TEXT NOT NULL, provider_model TEXT NOT NULL, external_transfer_consent_at TEXT, payload_json TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS generated_questions (id TEXT PRIMARY KEY, request_id TEXT NOT NULL, status TEXT NOT NULL, question_json TEXT NOT NULL, validation_json TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS generated_question_sources (id TEXT PRIMARY KEY, question_id TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL, excerpt TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS generation_official_documents (request_id TEXT NOT NULL, document_id TEXT NOT NULL, document_json TEXT NOT NULL, PRIMARY KEY (request_id, document_id));
    CREATE TABLE IF NOT EXISTS generation_reference_questions (request_id TEXT NOT NULL, reference_question_id TEXT NOT NULL, reference_json TEXT NOT NULL, PRIMARY KEY (request_id, reference_question_id));
    CREATE TABLE IF NOT EXISTS review_events (id TEXT PRIMARY KEY, question_id TEXT NOT NULL, action TEXT NOT NULL, reason TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS teacher_notes (id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, is_pinned INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS quick_quiz_sets (id TEXT PRIMARY KEY, subject TEXT NOT NULL, unit TEXT NOT NULL, topic TEXT NOT NULL, difficulty TEXT NOT NULL, question_format TEXT NOT NULL DEFAULT 'multiple_choice', question_count INTEGER NOT NULL, raw_output TEXT NOT NULL, model TEXT NOT NULL, prompt_version TEXT NOT NULL, status TEXT NOT NULL, question_review_states TEXT, question_points TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS chat_threads (id TEXT PRIMARY KEY, title TEXT NOT NULL, is_pinned INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, model TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS teacher_schedules (id TEXT PRIMARY KEY, title TEXT NOT NULL, schedule_date TEXT NOT NULL, schedule_time TEXT, event_type TEXT NOT NULL, status TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, action TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL);`);
  // 기존 beta 데이터베이스에도 기본 객관식 형식을 넣어 새 선택값과 안전하게 호환한다.
  try { db.exec("ALTER TABLE quick_quiz_sets ADD COLUMN question_format TEXT NOT NULL DEFAULT 'multiple_choice'"); } catch (error) { if (!String(error?.message || error).includes("duplicate column name")) throw error; }
  // 기존 세트에는 null을 남긴다. 읽을 때 모든 문항을 검수 대기로 해석해 승인 오인을 막는다.
  try { db.exec("ALTER TABLE quick_quiz_sets ADD COLUMN question_review_states TEXT"); } catch (error) { if (!String(error?.message || error).includes("duplicate column name")) throw error; }
  try { db.exec("ALTER TABLE quick_quiz_sets ADD COLUMN question_points TEXT"); } catch (error) { if (!String(error?.message || error).includes("duplicate column name")) throw error; }
  const cacheOfficialDocument = db.prepare("INSERT INTO official_documents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(catalog_key) DO UPDATE SET title = excluded.title, subject = excluded.subject, unit = excluded.unit, applicable_year = excluded.applicable_year, document_type = excluded.document_type, official_url = excluded.official_url, issue_number = excluded.issue_number, rights_status = excluded.rights_status, summary = excluded.summary, cached_at = excluded.cached_at");
  const cachedAt = new Date().toISOString();
  for (const document of LOCAL_OFFICIAL_DOCUMENTS) cacheOfficialDocument.run(document.catalogKey, document.title, document.subject, document.unit, document.applicableYear, document.documentType, document.officialUrl, document.issueNumber, document.rightsStatus, document.summary, cachedAt);
  return {
    saveMaterial(material) { db.prepare("INSERT INTO reference_materials VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(material.id, material.title, material.subject, material.unit, material.materialType, material.filePath, material.contentSha256, material.createdAt); },
    saveMaterialChunk(chunk) { db.prepare("INSERT INTO material_chunks VALUES (?, ?, ?, ?, ?, ?)").run(chunk.id, chunk.materialId, chunk.chunkIndex, chunk.content, JSON.stringify(chunk.embedding), chunk.createdAt); },
    listMaterialCandidates(subject, unit) { return db.prepare("SELECT * FROM reference_materials WHERE subject = ? AND (unit = ? OR unit = '공통') ORDER BY created_at DESC").all(subject, unit); },
    listMaterials() { return db.prepare("SELECT * FROM reference_materials ORDER BY created_at DESC").all(); },
    listMaterialContents(subject, unit) { return db.prepare("SELECT c.content FROM material_chunks c INNER JOIN reference_materials m ON m.id = c.material_id WHERE m.subject = ? AND (m.unit = ? OR m.unit = '공통') ORDER BY c.created_at DESC").all(subject, unit).map(row => row.content); },
    deleteMaterial(id) { db.prepare("DELETE FROM material_chunks WHERE material_id = ?").run(id); return db.prepare("DELETE FROM reference_materials WHERE id = ?").run(id); },
    saveReferenceQuestion(reference) { db.prepare("INSERT INTO reference_questions VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(reference.id, reference.subject, reference.unit, reference.source, reference.questionNumber || null, reference.questionText, reference.intent || null, reference.createdAt); },
    listReferenceQuestions(subject, unit) { const query = subject ? db.prepare("SELECT * FROM reference_questions WHERE subject = ? AND (unit = ? OR unit = '공통') ORDER BY created_at DESC") : db.prepare("SELECT * FROM reference_questions ORDER BY created_at DESC"); return subject ? query.all(subject, unit) : query.all(); },
    listOfficialDocuments(subject, unit = "공통") { return db.prepare("SELECT d.*, COALESCE(s.use_for_generation, 0) AS use_for_generation FROM official_documents d LEFT JOIN official_document_selections s ON d.catalog_key = s.catalog_key WHERE (d.subject = ? OR d.subject = '공통') AND (d.unit = ? OR d.unit = '공통') ORDER BY d.subject = '공통', d.title").all(subject, unit); },
    setOfficialDocumentSelection(catalogKey, useForGeneration) { db.prepare("INSERT INTO official_document_selections (catalog_key, use_for_generation, selected_at) VALUES (?, ?, ?) ON CONFLICT(catalog_key) DO UPDATE SET use_for_generation = excluded.use_for_generation, selected_at = excluded.selected_at").run(catalogKey, useForGeneration ? 1 : 0, new Date().toISOString()); },
    listSelectedOfficialDocuments(subject, unit = "공통") { return db.prepare("SELECT d.* FROM official_documents d INNER JOIN official_document_selections s ON d.catalog_key = s.catalog_key WHERE s.use_for_generation = 1 AND (d.subject = ? OR d.subject = '공통') AND (d.unit = ? OR d.unit = '공통') ORDER BY d.subject = '공통', d.title").all(subject, unit); },
    localOfficialCatalogForScope(subject, unit = "공통") { return documentsForScope(subject, unit); },
    getSetting(key, fallback = "") { return db.prepare("SELECT setting_value FROM local_settings WHERE setting_key = ?").get(key)?.setting_value || fallback; },
    setSetting(key, value) { db.prepare("INSERT INTO local_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at").run(key, value, new Date().toISOString()); },
    saveRequest(request) { db.prepare("INSERT INTO generation_requests VALUES (?, ?, ?, ?, ?, ?)").run(request.id, request.providerType, request.providerModel, request.externalTransferConsentAt || null, JSON.stringify(request), request.createdAt); },
    saveQuestion(question) { db.prepare("INSERT INTO generated_questions VALUES (?, ?, ?, ?, ?, ?)").run(question.id, question.requestId, question.status, JSON.stringify(question), JSON.stringify(question.validationReport || {}), question.createdAt); },
    saveQuestionSource(source) { db.prepare("INSERT INTO generated_question_sources VALUES (?, ?, ?, ?, ?, ?)").run(source.id, source.questionId, source.sourceType, source.sourceId, source.excerpt || null, source.createdAt); },
    saveOfficialEvidence(evidence) { db.prepare("INSERT INTO generation_official_documents VALUES (?, ?, ?)").run(evidence.requestId, evidence.documentId, JSON.stringify(evidence.document)); },
    saveReferenceEvidence(evidence) { db.prepare("INSERT INTO generation_reference_questions VALUES (?, ?, ?)").run(evidence.requestId, evidence.referenceQuestionId, JSON.stringify(evidence.reference)); },
    listQuestionSources(questionId) { return db.prepare("SELECT * FROM generated_question_sources WHERE question_id = ? ORDER BY created_at ASC").all(questionId); },
    saveReview(event) { db.prepare("INSERT INTO review_events VALUES (?, ?, ?, ?, ?)").run(event.id, event.questionId, event.action, event.reason || null, event.createdAt); },
    saveNote(note) { db.prepare("INSERT INTO teacher_notes VALUES (?, ?, ?, ?, ?, ?)").run(note.id, note.title, note.content, note.isPinned ? 1 : 0, note.createdAt, note.updatedAt); },
    listNotes() { return db.prepare("SELECT * FROM teacher_notes ORDER BY is_pinned DESC, updated_at DESC").all(); },
    updateNote(note) { return db.prepare("UPDATE teacher_notes SET title = ?, content = ?, is_pinned = ?, updated_at = ? WHERE id = ?").run(note.title, note.content, note.isPinned ? 1 : 0, note.updatedAt, note.id); },
    deleteNote(id) { return db.prepare("DELETE FROM teacher_notes WHERE id = ?").run(id); },
    // 일정은 이 PC의 시험일·마감 계획이며, AI 요청이나 외부 캘린더에 자동으로 전송하지 않는다.
    saveSchedule(item) { return db.prepare("INSERT INTO teacher_schedules VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, schedule_date = excluded.schedule_date, schedule_time = excluded.schedule_time, event_type = excluded.event_type, status = excluded.status, note = excluded.note, updated_at = excluded.updated_at").run(item.id, item.title, item.scheduleDate, item.scheduleTime || null, item.eventType, item.status, item.note || null, item.createdAt, item.updatedAt); },
    listSchedules() { return db.prepare("SELECT * FROM teacher_schedules ORDER BY schedule_date ASC, schedule_time ASC, updated_at DESC").all(); },
    deleteSchedule(id) { return db.prepare("DELETE FROM teacher_schedules WHERE id = ?").run(id); },
    // 새 쪽지시험은 문항 수만큼 독립된 검수 대기 상태를 먼저 저장한다.
    saveQuickQuizSet(quiz) { const states = normalizeQuickQuizQuestionStates(quiz.questionReviewStates, quiz.questionCount); const points = normalizeQuickQuizQuestionPoints(quiz.questionPoints, quiz.questionCount); db.prepare("INSERT INTO quick_quiz_sets (id, subject, unit, topic, difficulty, question_format, question_count, raw_output, model, prompt_version, status, question_review_states, question_points, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(quiz.id, quiz.subject, quiz.unit, quiz.topic, quiz.difficulty, quiz.questionFormat || "multiple_choice", quiz.questionCount, quiz.rawOutput, quiz.model, quiz.promptVersion, summarizeQuickQuizReview(states), JSON.stringify(states), JSON.stringify(points), quiz.createdAt, quiz.updatedAt); },
    listQuickQuizSets() { return db.prepare("SELECT *, COALESCE(question_format, 'multiple_choice') AS question_format FROM quick_quiz_sets ORDER BY updated_at DESC").all().map(quiz => { const states = normalizeQuickQuizQuestionStates(quiz.question_review_states, quiz.question_count); const points = normalizeQuickQuizQuestionPoints(quiz.question_points, quiz.question_count); return { ...quiz, question_review_states: JSON.stringify(states), question_points: JSON.stringify(points), questionReviewStates: states, questionPoints: points, status: summarizeQuickQuizReview(states) }; }); },
    // 과거 세트 단위 IPC도 남기되, 요청 상태를 모든 문항에 명시적으로 적용해 데이터 형식을 일관되게 유지한다.
    reviewQuickQuiz(input) { const row = db.prepare("SELECT question_count FROM quick_quiz_sets WHERE id = ?").get(input.id); if (!row) return undefined; const states = Array.from({ length: Math.max(1, Number(row.question_count) || 1) }, () => QUICK_QUIZ_REVIEW_STATES.includes(input.status) ? input.status : "revised"); return db.prepare("UPDATE quick_quiz_sets SET status = ?, question_review_states = ?, updated_at = ? WHERE id = ?").run(summarizeQuickQuizReview(states), JSON.stringify(states), input.updatedAt, input.id); },
    // 한 문항의 상태만 바꾸고 세트 요약을 재계산한다. 상태 배열은 SQLite에 JSON 문자열로 보관한다.
    reviewQuickQuizQuestion(input) { const row = db.prepare("SELECT question_count, question_review_states FROM quick_quiz_sets WHERE id = ?").get(input.id); if (!row || input.questionIndex < 0 || input.questionIndex >= Number(row.question_count)) return undefined; const states = normalizeQuickQuizQuestionStates(row.question_review_states, row.question_count); states[input.questionIndex] = QUICK_QUIZ_REVIEW_STATES.includes(input.status) && input.status !== "pending_review" ? input.status : "revised"; const status = summarizeQuickQuizReview(states); db.prepare("UPDATE quick_quiz_sets SET status = ?, question_review_states = ?, updated_at = ? WHERE id = ?").run(status, JSON.stringify(states), input.updatedAt, input.id); return { states, status }; },
    // 한 문항의 배점만 저장해, 검수 상태·다른 문항의 배점과 서로 영향을 주지 않게 한다.
    updateQuickQuizQuestionPoints(input) { const row = db.prepare("SELECT question_count, question_points FROM quick_quiz_sets WHERE id = ?").get(input.id); if (!row || input.questionIndex < 0 || input.questionIndex >= Number(row.question_count)) return undefined; const points = normalizeQuickQuizQuestionPoints(row.question_points, row.question_count); points[input.questionIndex] = input.points; db.prepare("UPDATE quick_quiz_sets SET question_points = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(points), input.updatedAt, input.id); return points; },
    deleteQuickQuizSet(id) { return db.prepare("DELETE FROM quick_quiz_sets WHERE id = ?").run(id); },
    // 일부만 승인된 세트도 학생용 출력 후보가 된다. 실제 문항 필터링은 호출부에서 상태 배열로 처리한다.
    listQuickQuizSetsWithApprovedQuestions() { return this.listQuickQuizSets().filter(quiz => quiz.questionReviewStates.includes("approved")); },
    listApprovedQuickQuizSets() { return this.listQuickQuizSetsWithApprovedQuestions().filter(quiz => quiz.status === "approved"); },
    saveChatThread(thread) { db.prepare("INSERT INTO chat_threads VALUES (?, ?, ?, ?, ?)").run(thread.id, thread.title, thread.isPinned ? 1 : 0, thread.createdAt, thread.updatedAt); },
    getChatThread(id) { return db.prepare("SELECT * FROM chat_threads WHERE id = ?").get(id); },
    listChatThreads() { return db.prepare("SELECT t.*, (SELECT COUNT(*) FROM chat_messages m WHERE m.thread_id = t.id) AS message_count FROM chat_threads t ORDER BY t.is_pinned DESC, t.updated_at DESC").all(); },
    listChatMessages(threadId) { return db.prepare("SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY created_at ASC").all(threadId); },
    saveChatMessage(message) { db.prepare("INSERT INTO chat_messages VALUES (?, ?, ?, ?, ?, ?)").run(message.id, message.threadId, message.role, message.content, message.model || null, message.createdAt); },
    updateChatThread(thread) { return db.prepare("UPDATE chat_threads SET title = ?, is_pinned = ?, updated_at = ? WHERE id = ?").run(thread.title, thread.isPinned ? 1 : 0, thread.updatedAt, thread.id); },
    deleteChatThread(id) { db.prepare("DELETE FROM chat_messages WHERE thread_id = ?").run(id); return db.prepare("DELETE FROM chat_threads WHERE id = ?").run(id); },
    audit(event) { db.prepare("INSERT INTO audit_events VALUES (?, ?, ?, ?)").run(event.id, event.action, JSON.stringify(event.payload || {}), event.createdAt); },
    listQuestions(status) { const query = status ? db.prepare("SELECT status, question_json FROM generated_questions WHERE status = ? ORDER BY created_at DESC") : db.prepare("SELECT status, question_json FROM generated_questions ORDER BY created_at DESC"); return (status ? query.all(status) : query.all()).map(row => ({ ...JSON.parse(row.question_json), status: row.status })); },
    reviewQuestion(input) { db.prepare("UPDATE generated_questions SET status = ? WHERE id = ?").run(input.status, input.questionId); return db.prepare("INSERT INTO review_events VALUES (?, ?, ?, ?, ?)").run(input.id, input.questionId, input.status, input.reason || null, input.createdAt); },
    listApproved() { return this.listQuestions("approved"); },
    createBackupSnapshot() {
      const tables = ["reference_materials", "material_chunks", "reference_questions", "official_documents", "official_document_selections", "local_settings", "generation_requests", "generated_questions", "generated_question_sources", "generation_official_documents", "generation_reference_questions", "review_events", "teacher_notes", "teacher_schedules", "quick_quiz_sets", "chat_threads", "chat_messages", "audit_events"];
      return { schemaVersion: 7, exportedAt: new Date().toISOString(), tables: Object.fromEntries(tables.map(table => [table, db.prepare(`SELECT * FROM ${table}`).all()])) };
    },
    restoreBackupSnapshot(snapshot) {
      const required = ["reference_materials", "material_chunks", "reference_questions", "official_documents", "official_document_selections", "local_settings", "generation_requests", "generated_questions", "generated_question_sources", "generation_official_documents", "generation_reference_questions", "review_events", "teacher_notes", "teacher_schedules", "quick_quiz_sets", "chat_threads", "chat_messages", "audit_events"];
      if (!snapshot || ![1, 2, 3, 4, 5, 6, 7].includes(snapshot.schemaVersion) || !snapshot.tables) throw new Error("지원하지 않거나 손상된 백업 내용입니다.");
      const tables = { ...snapshot.tables, teacher_notes: snapshot.tables.teacher_notes || [], teacher_schedules: snapshot.tables.teacher_schedules || [], quick_quiz_sets: snapshot.tables.quick_quiz_sets || [], chat_threads: snapshot.tables.chat_threads || [], chat_messages: snapshot.tables.chat_messages || [] };
      if (required.some(table => !Array.isArray(tables[table]))) throw new Error("지원하지 않거나 손상된 백업 내용입니다.");
      const columns = {
        reference_materials: ["id", "title", "subject", "unit", "material_type", "file_path", "content_sha256", "created_at"], material_chunks: ["id", "material_id", "chunk_index", "content", "embedding_json", "created_at"], reference_questions: ["id", "subject", "unit", "source", "question_number", "question_text", "intent", "created_at"], official_documents: ["catalog_key", "title", "subject", "unit", "applicable_year", "document_type", "official_url", "issue_number", "rights_status", "summary", "cached_at"], official_document_selections: ["catalog_key", "use_for_generation", "selected_at"], local_settings: ["setting_key", "setting_value", "updated_at"], generation_requests: ["id", "provider_type", "provider_model", "external_transfer_consent_at", "payload_json", "created_at"], generated_questions: ["id", "request_id", "status", "question_json", "validation_json", "created_at"], generated_question_sources: ["id", "question_id", "source_type", "source_id", "excerpt", "created_at"], generation_official_documents: ["request_id", "document_id", "document_json"], generation_reference_questions: ["request_id", "reference_question_id", "reference_json"], review_events: ["id", "question_id", "action", "reason", "created_at"], teacher_notes: ["id", "title", "content", "is_pinned", "created_at", "updated_at"], teacher_schedules: ["id", "title", "schedule_date", "schedule_time", "event_type", "status", "note", "created_at", "updated_at"], quick_quiz_sets: ["id", "subject", "unit", "topic", "difficulty", "question_format", "question_count", "raw_output", "model", "prompt_version", "status", "question_review_states", "question_points", "created_at", "updated_at"], chat_threads: ["id", "title", "is_pinned", "created_at", "updated_at"], chat_messages: ["id", "thread_id", "role", "content", "model", "created_at"], audit_events: ["id", "action", "payload_json", "created_at"] };
      db.exec("BEGIN");
      try {
        for (const table of [...required].reverse()) db.exec(`DELETE FROM ${table}`);
        for (const table of required) {
          const fields = columns[table]; const insert = db.prepare(`INSERT INTO ${table} (${fields.join(", ")}) VALUES (${fields.map(() => "?").join(", ")})`);
          for (const row of tables[table]) insert.run(...fields.map(field => row[field] ?? (field === "question_format" ? "multiple_choice" : field === "question_review_states" ? JSON.stringify(normalizeQuickQuizQuestionStates(null, row.question_count)) : field === "question_points" ? JSON.stringify(normalizeQuickQuizQuestionPoints(null, row.question_count)) : null)));
        }
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
    },
    close() { db.close(); },
  };
}
export function exportQuestionsCsv(questions) {
  const escape = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = ["ID", "문제", "보기", "정답", "해설", "출제 의도", "난이도", "배점", "유형", "모델", "프롬프트 버전", "검수 상태"];
  const rows = questions.map(question => [question.id, question.questionText, (question.choices || []).join(" | "), question.answer, question.explanation, question.intent, question.difficulty, question.points, question.questionType, question.model || "로컬 모델", question.promptVersion || "local-only-v1", question.status]);
  return [header, ...rows].map(row => row.map(escape).join(",")).join("\n");
}

const graphWidth = 560;
const graphHeight = 280;
const transparentPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLqpgAAAABJRU5ErkJggg==", "base64");

function escapeXml(value) { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;"); }

// 로컬 앱에서도 웹과 같은 그래프 데이터를 교사용 문서에 재현합니다.
function graphToSvg(spec) {
  const allPoints = spec.series.flatMap(series => series.points);
  const xValues = allPoints.map(point => point.x);
  const yValues = allPoints.map(point => point.y);
  const xMin = Math.min(...xValues, 0); const xMax = Math.max(...xValues, 1);
  const yMin = Math.min(...yValues, 0); const yMax = Math.max(...yValues, 1);
  const pad = { left: 56, right: 24, top: 34, bottom: 48 };
  const plotWidth = graphWidth - pad.left - pad.right; const plotHeight = graphHeight - pad.top - pad.bottom;
  const scaleX = value => pad.left + ((value - xMin) / (xMax - xMin || 1)) * plotWidth;
  const scaleY = value => pad.top + plotHeight - ((value - yMin) / (yMax - yMin || 1)) * plotHeight;
  const lines = spec.series.map((series, index) => {
    const color = series.color || ["#15856B", "#2D6496", "#B56716", "#7B56B3"][index % 4];
    const points = series.points.map(point => `${scaleX(point.x).toFixed(1)},${scaleY(point.y).toFixed(1)}`).join(" ");
    return `<polyline fill="none" stroke="${escapeXml(color)}" stroke-width="3" points="${points}"/><text x="${pad.left + 8}" y="${pad.top + 18 + index * 18}" fill="${escapeXml(color)}" font-size="13" font-family="Arial, sans-serif">${escapeXml(series.name)}</text>`;
  }).join("");
  const xAxis = `${escapeXml(spec.xAxis.label)}${spec.xAxis.unit ? ` (${escapeXml(spec.xAxis.unit)})` : ""}`;
  const yAxis = `${escapeXml(spec.yAxis.label)}${spec.yAxis.unit ? ` (${escapeXml(spec.yAxis.unit)})` : ""}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${graphWidth}" height="${graphHeight}" viewBox="0 0 ${graphWidth} ${graphHeight}"><rect width="100%" height="100%" fill="#ffffff"/><text x="${graphWidth / 2}" y="20" text-anchor="middle" fill="#183248" font-size="15" font-weight="700" font-family="Arial, sans-serif">${escapeXml(spec.title)}</text><line x1="${pad.left}" y1="${pad.top + plotHeight}" x2="${pad.left + plotWidth}" y2="${pad.top + plotHeight}" stroke="#334155" stroke-width="1.5"/><line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + plotHeight}" stroke="#334155" stroke-width="1.5"/><text x="${pad.left + plotWidth / 2}" y="${graphHeight - 12}" text-anchor="middle" fill="#475569" font-size="12" font-family="Arial, sans-serif">${xAxis}</text><text x="14" y="${pad.top + plotHeight / 2}" transform="rotate(-90 14 ${pad.top + plotHeight / 2})" text-anchor="middle" fill="#475569" font-size="12" font-family="Arial, sans-serif">${yAxis}</text>${lines}</svg>`;
}

function localVisualBlocks(spec) {
  if (spec?.kind === "graph") return [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 120 }, children: [new ImageRun({ data: Buffer.from(graphToSvg(spec)), type: "svg", fallback: { data: transparentPng, type: "png" }, transformation: { width: graphWidth, height: graphHeight } })] })];
  if (spec?.kind === "table") {
    const header = new TableRow({ children: spec.columns.map(column => new TableCell({ shading: { fill: "E6F4EE" }, children: [new Paragraph({ children: [new TextRun({ text: column, bold: true })] })] })) });
    const rows = spec.rows.map(row => new TableRow({ children: spec.columns.map((_, index) => new TableCell({ children: [new Paragraph(row[index] || "")] })) }));
    return [new Paragraph({ text: spec.title, heading: HeadingLevel.HEADING_3, spacing: { before: 120, after: 80 } }), new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] })];
  }
  return [];
}

/** 학생용 문항 제목에는 교사가 선택한 배점만 덧붙이고 난이도·유형은 넣지 않는다. */
export function studentQuestionHeading(question, index, includePoints = false) {
  return `${index + 1}. ${question.questionText}${includePoints ? ` ［${question.points}점］` : ""}`;
}

// 실행 환경과 무관하게 같은 문항 구조를 교사가 편집 가능한 DOCX로 전달합니다.
export async function exportQuestionsDocx(questions, kind = "question-paper", options = {}) {
  const answerSheet = kind === "answer-sheet";
  const title = answerSheet ? "정답 및 해설지" : "문항 시험지";
  const children = [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: title, bold: true, size: 34, color: "183248" })] }), new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 320 }, children: [new TextRun({ text: answerSheet ? `${questions.length}문항 · 교사 최종 검수 후 실제 시험 범위와 다시 대조하세요.` : `${questions.length}문항`, size: 18, color: "64748B" })] })];
  questions.forEach((question, index) => {
    children.push(new Paragraph({ spacing: { before: index === 0 ? 0 : 280, after: 120 }, children: [new TextRun({ text: answerSheet ? `${index + 1}. ${question.questionText}` : studentQuestionHeading(question, index, options.includePoints === true), size: 22, bold: answerSheet })] }), ...(answerSheet ? [new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `${question.questionType} · 난이도 ${question.difficulty} · ${question.points}점`, color: "475569", size: 18 })] })] : []));
    (question.choices || []).forEach((choice, choiceIndex) => children.push(new Paragraph({ indent: { left: 360 }, spacing: { after: 60 }, children: [new TextRun({ text: `${"①②③④⑤"[choiceIndex] || `${choiceIndex + 1}.`} ${choice}`, size: 21 })] })));
    children.push(...localVisualBlocks(question.visualSpec));
    if (answerSheet) children.push(new Paragraph({ spacing: { before: 120, after: 50 }, children: [new TextRun({ text: "정답  ", bold: true, color: "15856B" }), new TextRun({ text: question.answer, bold: true })] }), new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: "해설  ", bold: true, color: "183248" }), new TextRun(question.explanation)] }), new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "출제 의도  ", bold: true, color: "183248" }), new TextRun(question.intent)] }));
  });
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}

function escapeHtml(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;"); }

function localVisualHtml(spec) {
  if (spec?.kind === "graph") return `<div class="visual graph">${graphToSvg(spec)}</div>`;
  if (spec?.kind === "table") return `<section class="visual"><h3>${escapeHtml(spec.title)}</h3><table><thead><tr>${spec.columns.map(column => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${spec.rows.map(row => `<tr>${spec.columns.map((_, index) => `<td>${escapeHtml(row[index])}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`;
  return "";
}

// Electron·Tauri 셸은 이 HTML을 격리된 인쇄 창에 표시하고 운영체제의 PDF 저장 기능을 호출합니다.
export function exportQuestionsPrintHtml(questions, kind = "question-paper", options = {}) {
  const answerSheet = kind === "answer-sheet";
  const title = answerSheet ? "정답 및 해설지" : "문항 시험지";
  const items = questions.map((question, index) => `<article><h2>${index + 1}. ${escapeHtml(question.questionText)}${!answerSheet && options.includePoints ? ` <span class="points">［${question.points}점］</span>` : ""}</h2>${(question.choices || []).map((choice, choiceIndex) => `<p class="choice">${"①②③④⑤"[choiceIndex] || `${choiceIndex + 1}.`} ${escapeHtml(choice)}</p>`).join("")}${localVisualHtml(question.visualSpec)}${answerSheet ? `<section class="answer"><p><strong>정답</strong> ${escapeHtml(question.answer)}</p><p><strong>해설</strong> ${escapeHtml(question.explanation)}</p><p><strong>출제 의도</strong> ${escapeHtml(question.intent)}</p></section>` : ""}</article>`).join("");
  // 기본 플랜 학생용 시험지에만 하단 여백 표기를 넣어 정답·해설과 교사용 기록을 구분한다.
  const watermark = !answerSheet && options.watermark ? `<div class="student-watermark" aria-hidden="true">EunmaStudio</div>` : "";
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4;margin:18mm}body{font-family:"Noto Sans KR",Arial,sans-serif;color:#172033;line-height:1.6}h1{text-align:center;font-size:22px}h2{font-size:14px;white-space:pre-wrap}.points{font-weight:400;white-space:nowrap}.choice{margin:4px 0 4px 18px}.visual{margin:14px 0;break-inside:avoid}.graph svg{width:100%;height:auto}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #94a3b8;padding:6px;text-align:left}th{background:#e6f4ee}.answer{margin-top:12px;padding:10px 12px;background:#f8fafc;border-left:3px solid #15856b;font-size:12px}article{break-inside:avoid;margin:0 0 25px}.student-watermark{position:fixed;right:0;bottom:0;color:#94a3b8;font-size:9px;letter-spacing:.08em;opacity:.72;pointer-events:none}@media print{article{page-break-inside:avoid}}</style></head><body><h1>${title}</h1>${items}${watermark}</body></html>`;
}
