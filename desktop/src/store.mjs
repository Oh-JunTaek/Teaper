import { DatabaseSync } from "node:sqlite";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";

function databasePath() { return process.env.LOCAL_DATA_DB_PATH || join(process.env.LOCAL_APP_DATA_DIR || join(homedir(), ".teacher-assessment-assistant"), "teacher-assessment.sqlite"); }
export async function openLocalStore() {
  const path = databasePath();
  await mkdir(join(path, ".."), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS reference_materials (id TEXT PRIMARY KEY, title TEXT NOT NULL, subject TEXT NOT NULL, unit TEXT NOT NULL, material_type TEXT NOT NULL, file_path TEXT NOT NULL, content_sha256 TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS material_chunks (id TEXT PRIMARY KEY, material_id TEXT NOT NULL, chunk_index INTEGER NOT NULL, content TEXT NOT NULL, embedding_json TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reference_questions (id TEXT PRIMARY KEY, subject TEXT NOT NULL, unit TEXT NOT NULL, source TEXT NOT NULL, question_number TEXT, question_text TEXT NOT NULL, intent TEXT, created_at TEXT NOT NULL);
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
    listMaterials() { return db.prepare("SELECT * FROM reference_materials ORDER BY created_at DESC").all(); },
    listMaterialContents(subject, unit) { return db.prepare("SELECT c.content FROM material_chunks c INNER JOIN reference_materials m ON m.id = c.material_id WHERE m.subject = ? AND (m.unit = ? OR m.unit = '공통') ORDER BY c.created_at DESC").all(subject, unit).map(row => row.content); },
    deleteMaterial(id) { db.prepare("DELETE FROM material_chunks WHERE material_id = ?").run(id); return db.prepare("DELETE FROM reference_materials WHERE id = ?").run(id); },
    saveReferenceQuestion(reference) { db.prepare("INSERT INTO reference_questions VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(reference.id, reference.subject, reference.unit, reference.source, reference.questionNumber || null, reference.questionText, reference.intent || null, reference.createdAt); },
    listReferenceQuestions(subject, unit) { const query = subject ? db.prepare("SELECT * FROM reference_questions WHERE subject = ? AND (unit = ? OR unit = '공통') ORDER BY created_at DESC") : db.prepare("SELECT * FROM reference_questions ORDER BY created_at DESC"); return subject ? query.all(subject, unit) : query.all(); },
    saveRequest(request) { db.prepare("INSERT INTO generation_requests VALUES (?, ?, ?, ?, ?, ?)").run(request.id, request.providerType, request.providerModel, request.externalTransferConsentAt || null, JSON.stringify(request), request.createdAt); },
    saveQuestion(question) { db.prepare("INSERT INTO generated_questions VALUES (?, ?, ?, ?, ?, ?)").run(question.id, question.requestId, question.status, JSON.stringify(question), JSON.stringify(question.validationReport || {}), question.createdAt); },
    saveQuestionSource(source) { db.prepare("INSERT INTO generated_question_sources VALUES (?, ?, ?, ?, ?, ?)").run(source.id, source.questionId, source.sourceType, source.sourceId, source.excerpt || null, source.createdAt); },
    saveOfficialEvidence(evidence) { db.prepare("INSERT INTO generation_official_documents VALUES (?, ?, ?)").run(evidence.requestId, evidence.documentId, JSON.stringify(evidence.document)); },
    saveReferenceEvidence(evidence) { db.prepare("INSERT INTO generation_reference_questions VALUES (?, ?, ?)").run(evidence.requestId, evidence.referenceQuestionId, JSON.stringify(evidence.reference)); },
    listQuestionSources(questionId) { return db.prepare("SELECT * FROM generated_question_sources WHERE question_id = ? ORDER BY created_at ASC").all(questionId); },
    saveReview(event) { db.prepare("INSERT INTO review_events VALUES (?, ?, ?, ?, ?)").run(event.id, event.questionId, event.action, event.reason || null, event.createdAt); },
    audit(event) { db.prepare("INSERT INTO audit_events VALUES (?, ?, ?, ?)").run(event.id, event.action, JSON.stringify(event.payload || {}), event.createdAt); },
    listQuestions(status) { const query = status ? db.prepare("SELECT status, question_json FROM generated_questions WHERE status = ? ORDER BY created_at DESC") : db.prepare("SELECT status, question_json FROM generated_questions ORDER BY created_at DESC"); return (status ? query.all(status) : query.all()).map(row => ({ ...JSON.parse(row.question_json), status: row.status })); },
    reviewQuestion(input) { db.prepare("UPDATE generated_questions SET status = ? WHERE id = ?").run(input.status, input.questionId); return db.prepare("INSERT INTO review_events VALUES (?, ?, ?, ?, ?)").run(input.id, input.questionId, input.status, input.reason || null, input.createdAt); },
    listApproved() { return this.listQuestions("approved"); },
    close() { db.close(); },
  };
}
export function exportQuestionsCsv(questions) {
  const escape = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = ["ID", "문제", "보기", "정답", "해설", "출제 의도", "난이도", "배점", "유형", "검수 상태"];
  const rows = questions.map(question => [question.id, question.questionText, (question.choices || []).join(" | "), question.answer, question.explanation, question.intent, question.difficulty, question.points, question.questionType, question.status]);
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

// 실행 환경과 무관하게 같은 문항 구조를 교사가 편집 가능한 DOCX로 전달합니다.
export async function exportQuestionsDocx(questions, kind = "question-paper") {
  const answerSheet = kind === "answer-sheet";
  const title = answerSheet ? "정답 및 해설지" : "문항 시험지";
  const children = [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: title, bold: true, size: 34, color: "183248" })] }), new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 320 }, children: [new TextRun({ text: `${questions.length}문항 · 교사 최종 검수 후 실제 시험 범위와 다시 대조하세요.`, size: 18, color: "64748B" })] })];
  questions.forEach((question, index) => {
    children.push(new Paragraph({ spacing: { before: index === 0 ? 0 : 280, after: 120 }, children: [new TextRun({ text: `${index + 1}. `, bold: true, size: 24 }), new TextRun({ text: question.questionText, size: 22 })] }), new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `${question.questionType} · 난이도 ${question.difficulty} · ${question.points}점`, color: "475569", size: 18 })] }));
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
export function exportQuestionsPrintHtml(questions, kind = "question-paper") {
  const answerSheet = kind === "answer-sheet";
  const title = answerSheet ? "정답 및 해설지" : "문항 시험지";
  const items = questions.map((question, index) => `<article><h2>${index + 1}. ${escapeHtml(question.questionText)}</h2><p class="meta">${escapeHtml(question.questionType)} · 난이도 ${escapeHtml(question.difficulty)} · ${question.points}점</p>${(question.choices || []).map((choice, choiceIndex) => `<p class="choice">${"①②③④⑤"[choiceIndex] || `${choiceIndex + 1}.`} ${escapeHtml(choice)}</p>`).join("")}${localVisualHtml(question.visualSpec)}${answerSheet ? `<section class="answer"><p><strong>정답</strong> ${escapeHtml(question.answer)}</p><p><strong>해설</strong> ${escapeHtml(question.explanation)}</p><p><strong>출제 의도</strong> ${escapeHtml(question.intent)}</p></section>` : ""}</article>`).join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4;margin:18mm}body{font-family:"Noto Sans KR",Arial,sans-serif;color:#172033;line-height:1.6}h1{text-align:center;font-size:22px}h2{font-size:14px;white-space:pre-wrap}.meta{font-size:11px;color:#475569}.choice{margin:4px 0 4px 18px}.visual{margin:14px 0;break-inside:avoid}.graph svg{width:100%;height:auto}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #94a3b8;padding:6px;text-align:left}th{background:#e6f4ee}.answer{margin-top:12px;padding:10px 12px;background:#f8fafc;border-left:3px solid #15856b;font-size:12px}article{break-inside:avoid;margin:0 0 25px}@media print{article{page-break-inside:avoid}}</style></head><body><h1>${title}</h1><p style="text-align:center;font-size:11px;color:#64748b">${questions.length}문항 · 내보낸 뒤 실제 시험 범위와 교사 검수 내용을 다시 확인하세요.</p>${items}</body></html>`;
}
