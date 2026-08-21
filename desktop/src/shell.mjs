import { app, BrowserWindow, dialog, ipcMain, shell, session } from "electron";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createLocalBridge } from "./bridge.mjs";
import { exportQuestionsCsv, exportQuestionsDocx, exportQuestionsPrintHtml, openLocalStore } from "./store.mjs";
import { LOCAL_WINDOW_WEB_PREFERENCES, externalNavigationMessage, isAllowedLocalPage } from "./shellSecurity.mjs";

if (process.env.LOCAL_APP_MODE !== "true") throw new Error("로컬 앱은 LOCAL_APP_MODE=true에서만 실행됩니다.");

let bridge;
let store;
let mainWindow;

async function bridgeRequest(path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${bridge.port}${path}`, { ...options, headers: { authorization: `Bearer ${bridge.token}`, "content-type": "application/json", ...(options.headers || {}) } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "로컬 모델에 연결하지 못했습니다.");
  return payload;
}

function safeFilename(name) { return name.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80) || "문항"; }

function installWindowBoundary(window) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedLocalPage(url)) { event.preventDefault(); console.warn(externalNavigationMessage(url)); }
  });
}

async function saveExportFile(defaultPath, content) {
  const result = await dialog.showSaveDialog(mainWindow, { defaultPath, properties: ["createDirectory", "showOverwriteConfirmation"] });
  if (result.canceled || !result.filePath) return { saved: false };
  await mkdir(dirname(result.filePath), { recursive: true, mode: 0o700 });
  await writeFile(result.filePath, content, { mode: 0o600 });
  return { saved: true, path: result.filePath };
}

function recordExportAudit(kind, count, outcome) {
  store.audit({ id: randomUUID(), action: "local_export", payload: { kind, count, outcome }, createdAt: new Date().toISOString() });
}

async function showPrintPreview(html) {
  const preview = new BrowserWindow({ parent: mainWindow, modal: true, show: false, width: 900, height: 1000, title: "문항 인쇄 미리보기", backgroundColor: "#ffffff", webPreferences: LOCAL_WINDOW_WEB_PREFERENCES });
  installWindowBoundary(preview);
  await preview.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  preview.once("ready-to-show", () => preview.show());
  preview.webContents.print({ silent: false, printBackground: true });
  return { opened: true };
}

function localGenerationPrompt(input) {
  const materialText = store.listMaterialContents(input.subject, input.unit).slice(0, 8).join("\n\n");
  const references = store.listReferenceQuestions(input.subject, input.unit).slice(0, 5).map(item => `${item.source} ${item.question_number || ""}: ${item.question_text}`).join("\n");
  const officialDocuments = store.listSelectedOfficialDocuments(input.subject, input.unit);
  const officialContext = officialDocuments.map(document => `- ${document.title}: ${document.summary} (원문 대조: ${document.official_url})`).join("\n");
  return `당신은 교사의 문항 출제를 보조합니다. 최종 판단은 교사가 합니다.\n과목: ${input.subject}\n단원: ${input.unit}\n요청: ${input.request}\n\n[선택한 공식 자료 메타데이터]\n${officialContext || "선택한 공식 자료 없음 · 생성 전 공식 자료 화면에서 사용 여부를 확인하세요."}\n\n[교사 자료]\n${materialText || "등록된 텍스트 자료 없음"}\n\n[기출 참고]\n${references || "등록된 기출 참고 없음"}\n\n문항, 보기, 정답, 해설, 출제 의도를 구분해 한국어로 작성하세요. 계산·조건은 교사가 다시 검수할 수 있게 명확히 적으세요.`;
}

function registerHandlers() {
  ipcMain.handle("local:status", async () => bridgeRequest("/setup-plan"));
  ipcMain.handle("local:pull-model", async (_event, model) => bridgeRequest("/models/pull", { method: "POST", body: JSON.stringify({ model, confirmDownload: true }) }));
  ipcMain.handle("local:list-materials", () => store.listMaterials());
  ipcMain.handle("local:save-material", (_event, input) => {
    const now = new Date().toISOString(); const id = randomUUID(); const content = String(input.content || "");
    store.saveMaterial({ id, title: String(input.title || "새 자료"), subject: String(input.subject || "화학 I"), unit: String(input.unit || "공통"), materialType: "teaching", filePath: "local://manual-entry", contentSha256: createHash("sha256").update(content).digest("hex"), createdAt: now });
    if (content.trim()) store.saveMaterialChunk({ id: randomUUID(), materialId: id, chunkIndex: 0, content, embedding: [], createdAt: now });
    return { id };
  });
  ipcMain.handle("local:delete-material", (_event, id) => { store.deleteMaterial(String(id)); return { success: true }; });
  ipcMain.handle("local:list-references", (_event, input = {}) => store.listReferenceQuestions(input.subject, input.unit));
  ipcMain.handle("local:save-reference", (_event, input) => { const id = randomUUID(); store.saveReferenceQuestion({ id, subject: String(input.subject || "화학 I"), unit: String(input.unit || "공통"), source: String(input.source || "교사 등록 기출"), questionNumber: String(input.questionNumber || ""), questionText: String(input.questionText || ""), intent: String(input.intent || ""), createdAt: new Date().toISOString() }); return { id }; });
  ipcMain.handle("local:list-official-documents", (_event, input = {}) => store.listOfficialDocuments(String(input.subject || "화학 I"), String(input.unit || "공통")));
  ipcMain.handle("local:set-official-document-selection", (_event, input) => { store.setOfficialDocumentSelection(String(input.catalogKey), input.useForGeneration === true); return { success: true }; });
  ipcMain.handle("local:generate-question", async (_event, input) => {
    const prompt = localGenerationPrompt(input); const generated = await bridgeRequest("/generate", { method: "POST", body: JSON.stringify({ model: input.model, prompt, runtime: input.runtime || "ollama", options: { temperature: 0.2, maxTokens: 1200 } }) });
    const now = new Date().toISOString(); const requestId = randomUUID(); const questionId = randomUUID();
    store.saveRequest({ id: requestId, providerType: "local", providerModel: generated.model, externalTransferConsentAt: null, payload: { subject: input.subject, unit: input.unit, request: input.request }, createdAt: now });
    const officialDocuments = store.listSelectedOfficialDocuments(input.subject, input.unit);
    for (const document of officialDocuments) store.saveOfficialEvidence({ requestId, documentId: document.catalog_key, document: { catalogKey: document.catalog_key, title: document.title, officialUrl: document.official_url, summary: document.summary, rightsStatus: document.rights_status } });
    store.saveQuestion({ id: questionId, requestId, status: "pending_review", questionText: generated.response, choices: [], answer: "교사 확인 필요", explanation: "로컬 모델 생성 결과를 바탕으로 교사가 정답·해설을 확인해야 합니다.", intent: input.request, difficulty: input.difficulty || "중", points: Number(input.points || 3), questionType: input.questionType || "자료 분석형", model: generated.model, promptVersion: "local-only-v1", validationReport: { localOnly: true, officialDocumentCount: officialDocuments.length }, createdAt: now });
    return { id: questionId, response: generated.response };
  });
  ipcMain.handle("local:list-questions", (_event, status) => store.listQuestions(status));
  ipcMain.handle("local:review-question", (_event, input) => { store.reviewQuestion({ id: randomUUID(), questionId: String(input.questionId), status: input.status, reason: String(input.reason || ""), createdAt: new Date().toISOString() }); return { success: true }; });
  ipcMain.handle("local:export-approved", async (_event, input) => {
    const questions = store.listApproved(); if (!questions.length) throw new Error("내보낼 승인 문항이 없습니다.");
    if (input.kind === "csv") { const result = await saveExportFile("승인-문항-목록.csv", `\ufeff${exportQuestionsCsv(questions)}`); recordExportAudit(input.kind, questions.length, result.saved ? "saved" : "cancelled"); return result; }
    if (input.kind === "docx-question") { const result = await saveExportFile("문항-시험지.docx", await exportQuestionsDocx(questions, "question-paper")); recordExportAudit(input.kind, questions.length, result.saved ? "saved" : "cancelled"); return result; }
    if (input.kind === "docx-answer") { const result = await saveExportFile("문항-정답-해설지.docx", await exportQuestionsDocx(questions, "answer-sheet")); recordExportAudit(input.kind, questions.length, result.saved ? "saved" : "cancelled"); return result; }
    if (input.kind === "print-question") { const result = await showPrintPreview(exportQuestionsPrintHtml(questions, "question-paper")); recordExportAudit(input.kind, questions.length, "preview_opened"); return result; }
    if (input.kind === "print-answer") { const result = await showPrintPreview(exportQuestionsPrintHtml(questions, "answer-sheet")); recordExportAudit(input.kind, questions.length, "preview_opened"); return result; }
    throw new Error("지원하지 않는 내보내기 형식입니다.");
  });
}

app.whenReady().then(async () => {
  app.setAppUserModelId("com.eunmastudio.teacherassessment.local");
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  bridge = await createLocalBridge();
  store = await openLocalStore();
  registerHandlers();
  mainWindow = new BrowserWindow({ width: 1280, height: 860, minWidth: 980, minHeight: 720, show: false, title: "문제 출제 워크스페이스 · 로컬", backgroundColor: "#f7faf8", webPreferences: { ...LOCAL_WINDOW_WEB_PREFERENCES, preload: join(import.meta.dirname, "preload.mjs") } });
  installWindowBoundary(mainWindow);
  await mainWindow.loadFile(join(import.meta.dirname, "../renderer/index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", () => { try { store?.close(); bridge?.server.close(); } catch { /* graceful exit */ } });
