import { DatabaseSync } from "node:sqlite";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

function databasePath() { return process.env.LOCAL_DATA_DB_PATH || join(process.env.LOCAL_APP_DATA_DIR || join(homedir(), ".teacher-assessment-assistant"), "teacher-assessment.sqlite"); }
export async function openLocalStore() {
  const path = databasePath();
  await mkdir(join(path, ".."), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS reference_materials (id TEXT PRIMARY KEY, title TEXT NOT NULL, subject TEXT NOT NULL, unit TEXT NOT NULL, material_type TEXT NOT NULL, file_path TEXT NOT NULL, content_sha256 TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS material_chunks (id TEXT PRIMARY KEY, material_id TEXT NOT NULL, chunk_index INTEGER NOT NULL, content TEXT NOT NULL, embedding_json TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS generation_requests (id TEXT PRIMARY KEY, provider_type TEXT NOT NULL, provider_model TEXT NOT NULL, external_transfer_consent_at TEXT, payload_json TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS generated_questions (id TEXT PRIMARY KEY, request_id TEXT NOT NULL, status TEXT NOT NULL, question_json TEXT NOT NULL, validation_json TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS generated_question_sources (id TEXT PRIMARY KEY, question_id TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL, excerpt TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS generation_official_documents (request_id TEXT NOT NULL, document_id TEXT NOT NULL, document_json TEXT NOT NULL, PRIMARY KEY (request_id, document_id));
    CREATE TABLE IF NOT EXISTS generation_reference_questions (request_id TEXT NOT NULL, reference_question_id TEXT NOT NULL, reference_json TEXT NOT NULL, PRIMARY KEY (request_id, reference_question_id));
    CREATE TABLE IF NOT EXISTS review_events (id TEXT PRIMARY KEY, question_id TEXT NOT NULL, action TEXT NOT NULL, reason TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, action TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL);`);
  return {
    saveMaterial(material) { db.prepare("INSERT INTO reference_materials VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(material.id, material.title, material.subject, material.unit, material.materialType, material.filePath, material.contentSha256, material.createdAt); },
    saveMaterialChunk(chunk) { db.prepare("INSERT INTO material_chunks VALUES (?, ?, ?, ?, ?, ?)").run(chunk.id, chunk.materialId, chunk.chunkIndex, chunk.content, JSON.stringify(chunk.embedding), chunk.createdAt); },
    listMaterialCandidates(subject, unit) { return db.prepare("SELECT * FROM reference_materials WHERE subject = ? AND (unit = ? OR unit = '공통') ORDER BY created_at DESC").all(subject, unit); },
    saveRequest(request) { db.prepare("INSERT INTO generation_requests VALUES (?, ?, ?, ?, ?, ?)").run(request.id, request.providerType, request.providerModel, request.externalTransferConsentAt || null, JSON.stringify(request), request.createdAt); },
    saveQuestion(question) { db.prepare("INSERT INTO generated_questions VALUES (?, ?, ?, ?, ?, ?)").run(question.id, question.requestId, question.status, JSON.stringify(question), JSON.stringify(question.validationReport || {}), question.createdAt); },
    saveQuestionSource(source) { db.prepare("INSERT INTO generated_question_sources VALUES (?, ?, ?, ?, ?, ?)").run(source.id, source.questionId, source.sourceType, source.sourceId, source.excerpt || null, source.createdAt); },
    saveOfficialEvidence(evidence) { db.prepare("INSERT INTO generation_official_documents VALUES (?, ?, ?)").run(evidence.requestId, evidence.documentId, JSON.stringify(evidence.document)); },
    saveReferenceEvidence(evidence) { db.prepare("INSERT INTO generation_reference_questions VALUES (?, ?, ?)").run(evidence.requestId, evidence.referenceQuestionId, JSON.stringify(evidence.reference)); },
    listQuestionSources(questionId) { return db.prepare("SELECT * FROM generated_question_sources WHERE question_id = ? ORDER BY created_at ASC").all(questionId); },
    saveReview(event) { db.prepare("INSERT INTO review_events VALUES (?, ?, ?, ?, ?)").run(event.id, event.questionId, event.action, event.reason || null, event.createdAt); },
    audit(event) { db.prepare("INSERT INTO audit_events VALUES (?, ?, ?, ?)").run(event.id, event.action, JSON.stringify(event.payload || {}), event.createdAt); },
    listApproved() { return db.prepare("SELECT question_json FROM generated_questions WHERE status = 'approved' ORDER BY created_at DESC").all().map(row => JSON.parse(row.question_json)); },
    close() { db.close(); },
  };
}
export function exportQuestionsCsv(questions) {
  const escape = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = ["ID", "문제", "보기", "정답", "해설", "출제 의도", "난이도", "배점", "유형", "검수 상태"];
  const rows = questions.map(question => [question.id, question.questionText, (question.choices || []).join(" | "), question.answer, question.explanation, question.intent, question.difficulty, question.points, question.questionType, question.status]);
  return [header, ...rows].map(row => row.map(escape).join(",")).join("\n");
}
