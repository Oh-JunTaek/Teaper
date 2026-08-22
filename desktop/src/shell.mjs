import { app, BrowserWindow, dialog, ipcMain, shell, session } from "electron";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createLocalBridge } from "./bridge.mjs";
import { openBackup, sealBackup } from "./backup.mjs";
import { exportQuestionsCsv, exportQuestionsDocx, exportQuestionsPrintHtml, openLocalStore } from "./store.mjs";
import { isPotentialPromptDisclosure, isPromptDisclosureRequest, localQuickQuizPrompt, QUICK_QUIZ_PROMPT_VERSION } from "./quickQuizPolicy.mjs";
import { boundedChatHistory, chatTitleFromMessage, localChatPrompt } from "./chatPolicy.mjs";
import { DEFAULT_LOCAL_MODEL_SETTINGS, generationOptions, normalizeLocalModelSettings, supportsThinking } from "./localModelSettings.mjs";
import { LOCAL_WINDOW_WEB_PREFERENCES, externalNavigationMessage, isAllowedLocalPage } from "./shellSecurity.mjs";
import { extractGenerationPresentation } from "./generationResult.mjs";

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
  const teacherInstructions = store.getSetting("teacher_instructions").trim().slice(0, 1200);
  const base = `당신은 교사의 문항 출제를 보조합니다. 최종 판단은 교사가 합니다.\n과목: ${input.subject}\n단원: ${input.unit}\n요청: ${input.request}\n\n[선택한 공식 자료 메타데이터]\n${officialContext || "선택한 공식 자료 없음 · 생성 전 공식 자료 화면에서 사용 여부를 확인하세요."}\n\n[교사 자료]\n${materialText || "등록된 텍스트 자료 없음"}\n\n[기출 참고]\n${references || "등록된 기출 참고 없음"}\n\n아래 형식을 반드시 지키세요. 요청을 다시 설명하거나 인사·작업 안내·면책 문구를 문항 앞에 쓰지 마세요.\n### 문항\n문제 본문\n\n### 보기\n① 선택지\n② 선택지\n③ 선택지\n④ 선택지\n⑤ 선택지\n\n### 정답\n번호와 짧은 정답\n\n### 해설\n선지 판단과 필요한 계산·조건\n\n### 출제 의도\n확인할 개념 한두 문장\n\n그래프나 표가 반드시 필요한 경우에만 마지막에 [시각자료] 다음 줄의 json 코드 블록으로 {"kind":"graph" 또는 "table", ...}를 작성하세요. 그렇지 않으면 시각 자료 블록을 쓰지 마세요.`;
  return teacherInstructions ? `${base}\n\n[교사 추가 지시문]\n${teacherInstructions}\n\n위 추가 지시문은 자료 근거·정답 검토·교사 최종 검수 원칙을 바꾸지 않습니다.` : base;
}

function cleanSuggestedChatTitle(value, fallback) {
  const firstLine = String(value || "").replace(/[`#*_]/g, "").replace(/^(제목|대화 제목)\s*[:：]?\s*/i, "").split(/\r?\n/)[0].trim();
  return (firstLine || fallback).slice(0, 48);
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
  ipcMain.handle("local:get-preferences", () => {
    const modelSettings = (() => { try { return normalizeLocalModelSettings(JSON.parse(store.getSetting("local_model_settings", "{}"))); } catch { return DEFAULT_LOCAL_MODEL_SETTINGS; } })();
    return { teacherInstructions: store.getSetting("teacher_instructions"), modelSettings, chatLastModel: store.getSetting("chat_last_model"), chatSendOnEnter: store.getSetting("chat_send_on_enter") !== "false" };
  });
  ipcMain.handle("local:save-preferences", (_event, input = {}) => {
    const teacherInstructions = String(input.teacherInstructions || "").trim().slice(0, 1200);
    if (teacherInstructions && isPromptDisclosureRequest(teacherInstructions)) throw new Error("내부 지시문을 보거나 바꾸려는 내용은 저장할 수 없습니다. 수업·평가 표현 선호만 작성해 주세요.");
    const modelSettings = normalizeLocalModelSettings(input.modelSettings);
    store.setSetting("teacher_instructions", teacherInstructions);
    store.setSetting("local_model_settings", JSON.stringify(modelSettings));
    if (typeof input.chatSendOnEnter === "boolean") store.setSetting("chat_send_on_enter", input.chatSendOnEnter ? "true" : "false");
    return { success: true, modelSettings };
  });
  ipcMain.handle("local:list-notes", () => store.listNotes());
  ipcMain.handle("local:save-note", (_event, input) => {
    const now = new Date().toISOString(); const id = input.id ? String(input.id) : randomUUID(); const title = String(input.title || "").trim().slice(0, 160); const content = String(input.content || "").trim().slice(0, 12000);
    if (!title || !content) throw new Error("메모 제목과 내용을 입력해 주세요.");
    if (input.id) store.updateNote({ id, title, content, isPinned: input.isPinned === true, updatedAt: now }); else store.saveNote({ id, title, content, isPinned: input.isPinned === true, createdAt: now, updatedAt: now });
    return { id };
  });
  ipcMain.handle("local:delete-note", (_event, id) => { store.deleteNote(String(id)); return { success: true }; });
  ipcMain.handle("local:list-chat-threads", () => store.listChatThreads());
  ipcMain.handle("local:list-chat-messages", (_event, threadId) => store.listChatMessages(String(threadId)));
  ipcMain.handle("local:create-chat-thread", (_event, input = {}) => {
    const now = new Date().toISOString(); const id = randomUUID();
    store.saveChatThread({ id, title: String(input.title || "새 대화").trim().slice(0, 80) || "새 대화", isPinned: false, createdAt: now, updatedAt: now });
    return { id };
  });
  ipcMain.handle("local:update-chat-thread", (_event, input = {}) => {
    const current = store.getChatThread(String(input.id || "")); if (!current) throw new Error("대화 기록을 찾을 수 없습니다.");
    store.updateChatThread({ id: current.id, title: String(input.title ?? current.title).trim().slice(0, 80) || "새 대화", isPinned: input.isPinned === undefined ? Boolean(current.is_pinned) : input.isPinned === true, updatedAt: new Date().toISOString() });
    return { success: true };
  });
  ipcMain.handle("local:delete-chat-thread", (_event, id) => { store.deleteChatThread(String(id)); return { success: true }; });
  ipcMain.handle("local:warm-chat-model", async (_event, input = {}) => {
    const model = String(input.model || "").trim(); const runtime = input.runtime === "llama_cpp" ? "llama_cpp" : "ollama";
    if (!model) throw new Error("채팅에 사용할 로컬 모델을 선택해 주세요.");
    const settings = (() => { try { return normalizeLocalModelSettings(JSON.parse(store.getSetting("local_model_settings", "{}"))); } catch { return DEFAULT_LOCAL_MODEL_SETTINGS; } })();
    const result = await bridgeRequest("/chat/warm", { method: "POST", body: JSON.stringify({ model, runtime, options: generationOptions(settings) }) });
    store.setSetting("chat_last_model", `${runtime}:${model}`);
    return result;
  });
  ipcMain.handle("local:send-chat", async (_event, input = {}) => {
    const message = String(input.message || "").trim().slice(0, 6000); const model = String(input.model || "").trim();
    if (!message) throw new Error("질문을 입력해 주세요."); if (!model) throw new Error("실행할 로컬 모델을 선택해 주세요.");
    if (isPromptDisclosureRequest(message)) throw new Error("내부 지시문·보안 규칙은 공개하거나 대화 요청에 사용할 수 없습니다. 수업·자료·평가 관련 질문을 입력해 주세요.");
    const now = new Date().toISOString(); let thread = input.threadId ? store.getChatThread(String(input.threadId)) : null;
    if (!thread) { const id = randomUUID(); thread = { id, title: chatTitleFromMessage(message), is_pinned: 0, created_at: now, updated_at: now }; store.saveChatThread({ id, title: thread.title, isPinned: false, createdAt: now, updatedAt: now }); }
    const history = store.listChatMessages(thread.id);
    const settings = (() => { try { return normalizeLocalModelSettings(JSON.parse(store.getSetting("local_model_settings", "{}"))); } catch { return DEFAULT_LOCAL_MODEL_SETTINGS; } })();
    const runtime = input.runtime === "llama_cpp" ? "llama_cpp" : "ollama";
    const generated = await bridgeRequest("/generate", { method: "POST", body: JSON.stringify({ model, prompt: localChatPrompt({ message, history: boundedChatHistory(history), teacherInstructions: store.getSetting("teacher_instructions").trim().slice(0, 1200) }), runtime, options: generationOptions(settings), think: settings.thinkingEnabled && supportsThinking(model) }) });
    if (isPotentialPromptDisclosure(generated.response)) throw new Error("응답에서 내부 지시문 노출 가능성을 감지해 저장하지 않았습니다.");
    let nextTitle = history.length === 0 && thread.title === "새 대화" ? chatTitleFromMessage(message) : thread.title;
    if (history.length === 0 && thread.title === "새 대화") {
      try {
        const suggested = await bridgeRequest("/generate", { method: "POST", body: JSON.stringify({ model, runtime, prompt: `아래 교사 질문과 답변을 대표하는 한국어 대화 제목을 10~24자로 지으세요. 제목만 한 줄로 답하세요.\n\n질문: ${message}\n\n답변: ${generated.response.slice(0, 900)}`, options: { temperature: 0.15, maxTokens: 48 } }) });
        nextTitle = cleanSuggestedChatTitle(suggested.response, nextTitle);
      } catch { /* 제목 생성 실패는 첫 질문 제목을 유지하며 대화를 막지 않는다. */ }
    }
    store.saveChatMessage({ id: randomUUID(), threadId: thread.id, role: "user", content: message, createdAt: now });
    store.saveChatMessage({ id: randomUUID(), threadId: thread.id, role: "assistant", content: generated.response, model: generated.model, createdAt: new Date().toISOString() });
    store.updateChatThread({ id: thread.id, title: nextTitle, isPinned: Boolean(thread.is_pinned), updatedAt: new Date().toISOString() });
    store.setSetting("chat_last_model", `${runtime}:${model}`);
    store.audit({ id: randomUUID(), action: "local_chat_success", payload: { model: generated.model, runtime: generated.runtime, priorMessageCount: history.length }, createdAt: new Date().toISOString() });
    return { threadId: thread.id, response: generated.response, model: generated.model };
  });
  ipcMain.handle("local:create-backup", async (_event, input) => {
    const encrypted = sealBackup(store.createBackupSnapshot(), String(input.password || ""));
    const result = await saveExportFile("문제-출제-워크스페이스-로컬-백업.eunmabackup", encrypted);
    recordExportAudit("encrypted_backup", 0, result.saved ? "saved" : "cancelled");
    return result;
  });
  ipcMain.handle("local:restore-backup", async (_event, input) => {
    const chosen = await dialog.showOpenDialog(mainWindow, { title: "암호화 로컬 백업 열기", filters: [{ name: "문제 출제 워크스페이스 백업", extensions: ["eunmabackup"] }], properties: ["openFile"] });
    if (chosen.canceled || !chosen.filePaths[0]) return { restored: false };
    const snapshot = openBackup(await readFile(chosen.filePaths[0], "utf8"), String(input.password || ""));
    store.restoreBackupSnapshot(snapshot);
    recordExportAudit("encrypted_restore", 0, "restored");
    return { restored: true };
  });
  ipcMain.handle("local:generate-question", async (_event, input) => {
    const prompt = localGenerationPrompt(input);
    const modelSettings = (() => { try { return normalizeLocalModelSettings(JSON.parse(store.getSetting("local_model_settings", "{}"))); } catch { return DEFAULT_LOCAL_MODEL_SETTINGS; } })();
    const generated = await bridgeRequest("/generate", { method: "POST", body: JSON.stringify({ model: input.model, prompt, runtime: input.runtime || "ollama", options: generationOptions(modelSettings), think: modelSettings.thinkingEnabled && supportsThinking(input.model) }) });
    const presentation = extractGenerationPresentation(generated.response);
    const now = new Date().toISOString(); const requestId = randomUUID(); const questionId = randomUUID();
    store.saveRequest({ id: requestId, providerType: "local", providerModel: generated.model, externalTransferConsentAt: null, payload: { subject: input.subject, unit: input.unit, request: input.request, teacherInstructionsApplied: Boolean(store.getSetting("teacher_instructions").trim()), localModelSettings: modelSettings }, createdAt: now });
    const officialDocuments = store.listSelectedOfficialDocuments(input.subject, input.unit);
    for (const document of officialDocuments) store.saveOfficialEvidence({ requestId, documentId: document.catalog_key, document: { catalogKey: document.catalog_key, title: document.title, officialUrl: document.official_url, summary: document.summary, rightsStatus: document.rights_status } });
    store.saveQuestion({ id: questionId, requestId, status: "pending_review", questionText: presentation.text, choices: [], answer: "교사 확인 필요", explanation: "생성 결과의 정답·해설은 교사가 확인해야 합니다.", intent: input.request, difficulty: input.difficulty || "중", points: Number(input.points || 3), questionType: input.questionType || "자료 분석형", model: generated.model, promptVersion: "local-only-v1", visualSpec: presentation.visualSpec, validationReport: { localOnly: true, officialDocumentCount: officialDocuments.length }, createdAt: now });
    const materials = store.listMaterials().filter(item => item.subject === input.subject && item.unit === input.unit).slice(0, 8).map(item => ({ title: item.title, kind: "교사 자료" }));
    const referenceEvidence = store.listReferenceQuestions(input.subject, input.unit).slice(0, 5).map(item => ({ title: `${item.source}${item.question_number ? ` · ${item.question_number}번` : ""}`, kind: "기출 참고" }));
    return { id: questionId, response: presentation.text, visualSpec: presentation.visualSpec, evidence: { materials, references: referenceEvidence, officialDocuments: officialDocuments.map(item => ({ title: item.title, url: item.official_url, kind: "공식 자료" })) } };
  });
  ipcMain.handle("local:generate-quick-quiz", async (_event, input) => {
    const topic = String(input.topic || "").trim().slice(0, 160); const questionCount = Math.max(1, Math.min(10, Number(input.questionCount || 3)));
    if (!topic) throw new Error("확인할 개념 또는 정의를 입력해 주세요.");
    if (isPromptDisclosureRequest(`${input.subject || ""}\n${input.unit || ""}\n${topic}`)) throw new Error("내부 설정·지시문은 공개하거나 생성 요청에 사용할 수 없습니다. 확인할 학습 개념을 입력해 주세요.");
    const generated = await bridgeRequest("/generate", { method: "POST", body: JSON.stringify({ model: input.model, prompt: localQuickQuizPrompt({ ...input, topic, questionCount, teacherInstructions: store.getSetting("teacher_instructions").trim().slice(0, 600) }), runtime: input.runtime || "ollama", options: { temperature: 0.15, maxTokens: Math.min(1800, 280 * questionCount) } }) });
    if (isPotentialPromptDisclosure(generated.response)) throw new Error("쪽지시험 결과에서 내부 지시문 노출 가능성을 감지했습니다. 저장하지 않았습니다.");
    const now = new Date().toISOString(); const id = randomUUID();
    store.saveQuickQuizSet({ id, subject: String(input.subject || "화학 I").slice(0, 80), unit: String(input.unit || "공통").slice(0, 120), topic, difficulty: String(input.difficulty || "낮음").slice(0, 30), questionCount, rawOutput: generated.response, model: generated.model, promptVersion: QUICK_QUIZ_PROMPT_VERSION, status: "pending_review", createdAt: now, updatedAt: now });
    store.audit({ id: randomUUID(), action: "local_quick_quiz_generate", payload: { questionCount, model: generated.model }, createdAt: now });
    return { id, response: generated.response, model: generated.model };
  });
  ipcMain.handle("local:list-quick-quizzes", () => store.listQuickQuizSets());
  ipcMain.handle("local:review-quick-quiz", (_event, input) => { const status = ["approved", "revised", "rejected"].includes(input.status) ? input.status : "revised"; store.reviewQuickQuiz({ id: String(input.id), status, updatedAt: new Date().toISOString() }); return { success: true }; });
  ipcMain.handle("local:delete-quick-quiz", (_event, id) => { store.deleteQuickQuizSet(String(id)); return { success: true }; });
  ipcMain.handle("local:export-quick-quiz", async () => {
    const quizzes = store.listApprovedQuickQuizSets(); if (!quizzes.length) throw new Error("내보낼 승인 쪽지시험이 없습니다.");
    const content = quizzes.map((quiz, index) => `# ${index + 1}. ${quiz.subject} · ${quiz.unit}\n개념: ${quiz.topic}\n난이도: ${quiz.difficulty}\n생성 모델: ${quiz.model}\n\n${quiz.raw_output}`).join("\n\n---\n\n");
    const result = await saveExportFile("승인-쪽지시험.txt", `쪽지시험\n교사 최종 검수 후 사용하세요.\n\n${content}`); recordExportAudit("quick_quiz_text", quizzes.length, result.saved ? "saved" : "cancelled"); return result;
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
  mainWindow = new BrowserWindow({ width: 1280, height: 860, minWidth: 980, minHeight: 720, show: false, title: "문제 출제 워크스페이스 · 로컬", backgroundColor: "#f7faf8", webPreferences: { ...LOCAL_WINDOW_WEB_PREFERENCES, preload: join(import.meta.dirname, "preload.cjs") } });
  installWindowBoundary(mainWindow);
  await mainWindow.loadFile(join(import.meta.dirname, "../renderer/index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", () => { try { store?.close(); bridge?.server.close(); } catch { /* graceful exit */ } });
