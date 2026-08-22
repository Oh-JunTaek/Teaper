import { invokeLLM, listLLMModels } from "../_core/llm";
import { PDFParse } from "pdf-parse";
import type { ResolvedProvider } from "./aiProviders";
import { appendTeacherInstructions, buildGenerationSystemPrompt, buildQuickQuizSystemPrompt, buildValidationSystemPrompt, isPotentialPromptDisclosure, PROMPT_CONTRACT_VERSION, QUICK_QUIZ_PROMPT_VERSION, type ProviderKind } from "./assessmentPrompt";
import type { CalculationSpec } from "./mathVerification";

export const PROMPT_VERSION = PROMPT_CONTRACT_VERSION;
const VECTOR_SIZE = 128;

// 그래프·표를 설명문으로 대신하지 않고 실제 렌더링 가능한 데이터로 저장하는 공통 계약입니다.
export type QuestionVisualSpec =
  | { kind: "graph"; title: string; xAxis: { label: string; unit?: string }; yAxis: { label: string; unit?: string }; series: Array<{ name: string; color?: string; points: Array<{ x: number; y: number }> }> }
  | { kind: "table"; title: string; columns: string[]; rows: string[][] };

export type Draft = {
  questionText: string;
  choices: string[];
  answer: string;
  explanation: string;
  intent: string;
  usedConcepts: string[];
  visualSpec?: QuestionVisualSpec | null;
  calculation?: CalculationSpec | null;
};

export type Validation = {
  inScope: boolean;
  answerExplanationConsistent: boolean;
  difficultyAppropriate: boolean;
  guidanceCompliant: boolean;
  notes: string[];
  similarityScore: number;
  similarReferenceId: number | null;
  pass: boolean;
};

export type QuickQuizQuestion = { questionText: string; choices: string[]; answer: string; explanation: string; concept: string };

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createTextEmbedding(text: string): number[] {
  const cleaned = text.toLowerCase().replace(/\s+/g, " ").replace(/[^가-힣a-z0-9 ]/g, " ");
  const tokens = cleaned.split(" ").filter(Boolean);
  const features = [...tokens];
  for (const token of tokens) for (let index = 0; index < token.length - 1; index += 1) features.push(token.slice(index, index + 2));
  const vector = Array.from({ length: VECTOR_SIZE }, () => 0);
  features.forEach(feature => {
    const hash = stableHash(feature);
    vector[hash % VECTOR_SIZE] += hash % 2 === 0 ? 1 : -1;
  });
  const norm = Math.sqrt(vector.reduce((sum, item) => sum + item ** 2, 0));
  return norm ? vector.map(item => Number((item / norm).toFixed(6))) : vector;
}

export function cosineSimilarity(a: number[] | null | undefined, b: number[] | null | undefined) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  return Number(a.reduce((sum, item, index) => sum + item * (b[index] ?? 0), 0).toFixed(4));
}

export function splitIntoChunks(text: string, size = 900) {
  const normalized = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let current = "";
  normalized.split(/\n\n+/).forEach(paragraph => {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length <= size) current = next;
    else {
      if (current) chunks.push(current);
      if (paragraph.length <= size) current = paragraph;
      else {
        for (let index = 0; index < paragraph.length; index += size) chunks.push(paragraph.slice(index, index + size));
        current = "";
      }
    }
  });
  if (current) chunks.push(current);
  return chunks;
}

export function needsVisionFallback(text: string) {
  return text.replace(/\s+/g, "").length < 120;
}

// 시각 자료형 문항은 그래프를 문장으로만 설명하지 않도록, 렌더링 가능한 좌표·표 데이터의 기본값을 만듭니다.
// 교사는 검수 화면에서 축, 단위, 곡선, 수치를 직접 확인·수정할 수 있습니다.
export function buildQuestionVisual(input: { questionType: string; additionalRequirements?: string; unit: string }): QuestionVisualSpec | null {
  const request = `${input.unit} ${input.additionalRequirements || ""}`;
  if (input.questionType === "그래프 해석형") {
    const potentialEnergy = /퍼텐셜|결합|원자.?간 거리|potential/i.test(request);
    if (potentialEnergy) return { kind: "graph", title: "원자 간 거리와 퍼텐셜 에너지", xAxis: { label: "원자 간 거리", unit: "r" }, yAxis: { label: "퍼텐셜 에너지", unit: "PE" }, series: [{ name: "X", color: "#176B87", points: [{ x: 0, y: 7 }, { x: 1, y: 0.8 }, { x: 2, y: -5 }, { x: 3, y: -2.1 }, { x: 4, y: 0.1 }, { x: 5, y: 1.1 }] }, { name: "Y", color: "#C46B35", points: [{ x: 0, y: 6 }, { x: 1, y: 2.2 }, { x: 2, y: -1.2 }, { x: 3, y: -2.8 }, { x: 4, y: -1.1 }, { x: 5, y: 0.7 }] }] };
    return { kind: "graph", title: `${input.unit} 변화 그래프`, xAxis: { label: "독립 변인", unit: "상대 단위" }, yAxis: { label: "관찰값", unit: "상대 단위" }, series: [{ name: "A", color: "#176B87", points: [{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 5 }] }, { name: "B", color: "#C46B35", points: [{ x: 0, y: 4 }, { x: 1, y: 3 }, { x: 2, y: 2 }, { x: 3, y: 1 }] }] };
  }
  if (input.questionType === "실험 자료형" || /표|table/i.test(request)) return { kind: "table", title: `${input.unit} 관찰 자료`, columns: ["조건", "관찰값", "해석 기준"], rows: [["가", "자료 A", "비교"], ["나", "자료 B", "추론"]] };
  return null;
}

async function extractPdfTextFirst(signedUrl: string, fileName: string) {
  const response = await fetch(signedUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`PDF 원문을 읽지 못했습니다. (${response.status})`);
  const parser = new PDFParse({ data: Buffer.from(await response.arrayBuffer()) });
  try {
    const result = await parser.getText();
    const plainText = result.text.trim();
    if (needsVisionFallback(plainText)) return null;
    const headings = plainText.split(/\n+/).map(line => line.trim()).filter(line => line.length >= 4 && line.length <= 80).slice(0, 20);
    return { title: fileName.replace(/\.pdf$/i, ""), plainText, headings, keywords: [], cautions: ["PDF 텍스트 레이어에서 내용을 읽었습니다."], model: "pdf-text-parser", extractionMethod: "pdf_text" as const };
  } finally {
    await parser.destroy();
  }
}

async function selectModel(kind: "vision" | "generation" | "validation", provider?: ResolvedProvider) {
  if (provider && provider.kind !== "managed") return provider.model;
  const { data } = await listLLMModels();
  const preferred = kind === "vision"
    ? ["gemini-3-flash-preview", "gpt-5-mini", "claude-haiku-4-5"]
    : kind === "validation"
      ? ["gpt-5", "claude-sonnet-4-6", "gpt-5-mini"]
      : ["gpt-5-mini", "claude-sonnet-4-6", "gemini-3-flash-preview"];
  return preferred.find(id => data.some(model => model.id === id)) ?? data[0]?.id;
}

function contentOf(response: any) {
  const value = response.choices?.[0]?.message?.content;
  if (typeof value !== "string") throw new Error("AI 응답에 텍스트가 없습니다.");
  return value.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
}

type ProviderMessage = { role: "system" | "user"; content: string };

async function invokeForProvider(input: { provider?: ResolvedProvider; model?: string; messages: ProviderMessage[]; responseFormat: Record<string, unknown> }) {
  const provider = input.provider;
  if (!provider || provider.kind === "managed") return invokeLLM({ model: input.model, messages: input.messages, response_format: input.responseFormat as any });
  if (provider.kind === "ollama") {
    const response = await fetch(`${provider.baseUrl}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: provider.model, messages: input.messages, stream: false, format: (input.responseFormat as any).json_schema?.schema ?? "json" }), signal: AbortSignal.timeout(90_000) });
    if (!response.ok) throw new Error(`로컬 Ollama 호출 실패 (${response.status})`);
    const data = await response.json() as { message?: { content?: string } };
    return { model: provider.model, choices: [{ index: 0, message: { role: "assistant", content: data.message?.content || "" }, finish_reason: "stop" }] };
  }
  if (provider.kind === "openai_compatible") {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${provider.apiKey}` }, body: JSON.stringify({ model: provider.model, messages: input.messages, response_format: input.responseFormat }), signal: AbortSignal.timeout(90_000) });
    if (!response.ok) throw new Error(`개인 OpenAI 호환 API 호출 실패 (${response.status})`);
    return await response.json();
  }
  if (provider.kind === "anthropic") {
    const system = input.messages.find(message => message.role === "system")?.content || "";
    const messages = input.messages.filter(message => message.role !== "system");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": provider.apiKey || "", "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: provider.model, max_tokens: 4096, system, messages, output_config: { format: { type: "json_schema", schema: (input.responseFormat as any).json_schema?.schema } } }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) throw new Error(`개인 Claude API 호출 실패 (${response.status})`);
    const data = await response.json() as { model?: string; content?: Array<{ type?: string; text?: string }> };
    const content = data.content?.find(part => part.type === "text")?.text || "";
    return { model: data.model || provider.model, choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] };
  }
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": provider.apiKey || "" },
    body: JSON.stringify({ model: provider.model, input: input.messages.map(message => `${message.role === "system" ? "[지침]" : "[요청]"}\n${message.content}`).join("\n\n"), response_format: { type: "text", mime_type: "application/json", schema: (input.responseFormat as any).json_schema?.schema } }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`개인 Gemini API 호출 실패 (${response.status})`);
  const data = await response.json() as { output_text?: string };
  return { model: provider.model, choices: [{ index: 0, message: { role: "assistant", content: data.output_text || "" }, finish_reason: "stop" }] };
}

export async function extractDocumentText(input: { signedUrl: string; mimeType: string; fileName: string }) {
  if (input.mimeType === "application/pdf") {
    try {
      const parsed = await extractPdfTextFirst(input.signedUrl, input.fileName);
      if (parsed) return parsed;
    } catch {
      // 암호화·손상·스캔 PDF는 아래 시각 인식 보조 단계로 이어집니다.
    }
  }
  const model = await selectModel("vision");
  if (!model) throw new Error("사용 가능한 AI 모델을 찾을 수 없습니다.");
  const filePart = input.mimeType.startsWith("image/") ? { type: "image_url", image_url: { url: input.signedUrl, detail: "high" } } : { type: "file_url", file_url: { url: input.signedUrl, mime_type: "application/pdf" } };
  const response = await invokeLLM({ model, messages: [{ role: "system", content: "당신은 교육 문서 OCR 도우미입니다. 보이는 내용만 정확히 읽고 추정으로 내용을 보완하지 마십시오. 수식·표·번호를 가능한 한 보존하십시오." }, { role: "user", content: [{ type: "text", text: `파일명: ${input.fileName}\n문서를 OCR하고 검색 가능한 구조로 추출하십시오.` }, filePart] as any }], response_format: { type: "json_schema", json_schema: { name: "ocr_document", strict: true, schema: { type: "object", properties: { title: { type: "string" }, plainText: { type: "string" }, headings: { type: "array", items: { type: "string" } }, keywords: { type: "array", items: { type: "string" } }, cautions: { type: "array", items: { type: "string" } } }, required: ["title", "plainText", "headings", "keywords", "cautions"], additionalProperties: false } } } });
  const data = JSON.parse(contentOf(response));
  return { ...data, model, extractionMethod: input.mimeType === "application/pdf" ? "vision_pdf" : "vision_image" } as { title: string; plainText: string; headings: string[]; keywords: string[]; cautions: string[]; model: string; extractionMethod: "vision_pdf" | "vision_image" };
}

const draftSchema = { type: "json_schema", json_schema: { name: "question_draft", strict: true, schema: { type: "object", properties: { questionText: { type: "string" }, choices: { type: "array", items: { type: "string" } }, answer: { type: "string" }, explanation: { type: "string" }, intent: { type: "string" }, usedConcepts: { type: "array", items: { type: "string" } }, calculation: { anyOf: [{ type: "null" }, { type: "object", properties: { kind: { type: "string", enum: ["numeric_expression", "linear_equation", "proportion", "basic_statistics"] }, expression: { type: "string" }, expectedAnswer: { type: "string" } }, required: ["kind", "expression", "expectedAnswer"], additionalProperties: false }] } }, required: ["questionText", "choices", "answer", "explanation", "intent", "usedConcepts", "calculation"], additionalProperties: false } } };

const quickQuizSchema = { type: "json_schema", json_schema: { name: "quick_quiz", strict: true, schema: { type: "object", properties: { questions: { type: "array", items: { type: "object", properties: { questionText: { type: "string" }, choices: { type: "array", items: { type: "string" } }, answer: { type: "string" }, explanation: { type: "string" }, concept: { type: "string" } }, required: ["questionText", "choices", "answer", "explanation", "concept"], additionalProperties: false } } }, required: ["questions"], additionalProperties: false } } };

export async function generateQuickQuiz(input: { subject: string; unit: string; topic: string; difficulty: string; questionCount: number; customInstructions?: string }, provider?: ResolvedProvider) {
  const model = await selectModel("generation", provider);
  if (!model) throw new Error("사용 가능한 AI 모델을 찾을 수 없습니다.");
  const response = await invokeForProvider({ provider, model, messages: [
    { role: "system", content: appendTeacherInstructions(buildQuickQuizSystemPrompt((provider?.kind || "managed") as ProviderKind), input.customInstructions) },
    { role: "user", content: `쪽지시험 생성 요청\n- 과목: ${input.subject}\n- 단원: ${input.unit}\n- 확인할 개념: ${input.topic}\n- 난이도: ${input.difficulty}\n- 문항 수: ${input.questionCount}\n\n학생이 짧은 시간 안에 풀 수 있는 새로운 개념 확인 문항만 ${input.questionCount}개 생성하십시오.` },
  ], responseFormat: quickQuizSchema });
  const parsed = JSON.parse(contentOf(response)) as { questions: QuickQuizQuestion[] };
  if (parsed.questions.some(question => isPotentialPromptDisclosure(`${question.questionText}\n${question.answer}\n${question.explanation}\n${question.concept}`))) throw new Error("쪽지시험 결과에서 내부 지시문 노출 가능성을 감지했습니다. 저장하지 않았습니다.");
  const questions = parsed.questions.slice(0, input.questionCount).map(question => ({
    questionText: question.questionText.trim().slice(0, 220),
    choices: question.choices.slice(0, 4).map(choice => choice.trim().slice(0, 90)),
    answer: question.answer.trim().slice(0, 120),
    explanation: question.explanation.trim().slice(0, 260),
    concept: question.concept.trim().slice(0, 100),
  }));
  if (questions.length !== input.questionCount || questions.some(question => !question.questionText || !question.answer || !question.explanation)) throw new Error("쪽지시험 형식이 완전하지 않습니다. 다시 시도해 주세요.");
  return { questions, model, promptVersion: QUICK_QUIZ_PROMPT_VERSION };
}

export async function generateDraft(input: { subject: string; unit: string; difficulty: string; questionType: string; points: number; additionalRequirements?: string; curriculumContext: string; referenceContext: string; guidelineContext: string; customInstructions?: string }, provider?: ResolvedProvider) {
  const model = await selectModel("generation", provider);
  if (!model) throw new Error("사용 가능한 AI 모델을 찾을 수 없습니다.");
  const calculationInstruction = input.subject === "중등 수학" ? "\n\n[중등 수학 계산 확인]\n수치 계산·일차식·비례·평균/중앙값을 포함한 문항이면 calculation에 계산기용 식과 수치 정답을 반드시 작성하십시오. kind는 numeric_expression, linear_equation, proportion, basic_statistics 중 하나입니다. expression은 숫자, x, + - * / ( ) 또는 mean(...), median(...)만 사용하고, expectedAnswer는 보기 번호가 아닌 계산 결과 숫자만 넣으십시오. 계산 대상이 아니면 calculation은 null입니다." : "\n\n계산 확인 대상이 아니면 calculation은 null입니다.";
  const response = await invokeForProvider({ provider, model, messages: [{ role: "system", content: appendTeacherInstructions(buildGenerationSystemPrompt((provider?.kind || "managed") as ProviderKind), input.customInstructions) }, { role: "user", content: `요청 조건\n- 과목: ${input.subject}\n- 단원: ${input.unit}\n- 난이도: ${input.difficulty}\n- 유형: ${input.questionType}\n- 배점: ${input.points}점\n- 추가 요구: ${input.additionalRequirements || "없음"}\n\n[교육과정 근거]\n${input.curriculumContext || "등록된 교육과정 근거 없음"}\n\n[기출 유형 근거]\n${input.referenceContext || "등록된 기출 근거 없음"}\n\n[출제 지침 근거]\n${input.guidelineContext || "등록된 출제 지침 근거 없음"}${calculationInstruction}\n\n위 근거로 새로운 선택형 문항 1개를 작성하십시오.` }], responseFormat: draftSchema });
  return { draft: JSON.parse(contentOf(response)) as Draft, model };
}

const validationSchema = { type: "json_schema", json_schema: { name: "validation_result", strict: true, schema: { type: "object", properties: { inScope: { type: "boolean" }, answerExplanationConsistent: { type: "boolean" }, difficultyAppropriate: { type: "boolean" }, guidanceCompliant: { type: "boolean" }, tooSimilar: { type: "boolean" }, notes: { type: "array", items: { type: "string" } } }, required: ["inScope", "answerExplanationConsistent", "difficultyAppropriate", "guidanceCompliant", "tooSimilar", "notes"], additionalProperties: false } } };

export async function validateDraft(input: { draft: Draft; subject: string; unit: string; difficulty: string; curriculumContext: string; guidelineContext: string; similarityScore: number; similarReferenceId: number | null; similarReference?: { questionText: string; choices: string[] | null; intent: string } }, provider?: ResolvedProvider) {
  const model = await selectModel("validation", provider);
  if (!model) throw new Error("사용 가능한 AI 모델을 찾을 수 없습니다.");
  const response = await invokeForProvider({ provider, model, messages: [{ role: "system", content: buildValidationSystemPrompt((provider?.kind || "managed") as ProviderKind) }, { role: "user", content: `과목: ${input.subject}\n단원: ${input.unit}\n목표 난이도: ${input.difficulty}\n교육과정 근거: ${input.curriculumContext || "없음"}\n출제 지침 근거: ${input.guidelineContext || "없음"}\n\n[생성 문항]\n문항: ${input.draft.questionText}\n보기: ${(input.draft.choices ?? []).join(" | ")}\n정답: ${input.draft.answer}\n해설: ${input.draft.explanation}\n출제 의도: ${input.draft.intent}\n\n[가장 가까운 기출문제]\n문항: ${input.similarReference?.questionText || "없음"}\n보기: ${(input.similarReference?.choices || []).join(" | ")}\n출제 의도: ${input.similarReference?.intent || "없음"}\n\n두 문항이 문장·수치·자료구성·사고 과정까지 실질적으로 동일하거나 지나치게 유사하면 tooSimilar를 true로 판정하십시오.` }], responseFormat: validationSchema });
  const judged = JSON.parse(contentOf(response));
  const pass = Boolean(judged.inScope && judged.answerExplanationConsistent && judged.difficultyAppropriate && judged.guidanceCompliant && !judged.tooSimilar && input.similarityScore < 0.84);
  return { ...judged, similarityScore: input.similarityScore, similarReferenceId: input.similarReferenceId, pass, model } as Validation & { model: string };
}
