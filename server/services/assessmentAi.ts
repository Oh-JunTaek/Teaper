import { invokeLLM, listLLMModels } from "../_core/llm";
import { PDFParse } from "pdf-parse";

export const PROMPT_VERSION = "chem-rag-v1.0";
const VECTOR_SIZE = 128;

export type Draft = {
  questionText: string;
  choices: string[];
  answer: string;
  explanation: string;
  intent: string;
  usedConcepts: string[];
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

function stableHash(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createTextEmbedding(text: string): number[] {
  const cleaned = text.toLowerCase().replace(/\s+/g, " ").replace(/[^가-힣a-z0-9 ]/g, " ");
  const tokens = cleaned.split(" ").filter(Boolean);
  const features = [...tokens];
  for (const token of tokens) {
    for (let index = 0; index < token.length - 1; index += 1) features.push(token.slice(index, index + 2));
  }
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
  const paragraphs = normalized.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";
  paragraphs.forEach(paragraph => {
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

async function selectModel(kind: "vision" | "generation" | "validation") {
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
  const filePart = input.mimeType.startsWith("image/")
    ? { type: "image_url", image_url: { url: input.signedUrl, detail: "high" } }
    : { type: "file_url", file_url: { url: input.signedUrl, mime_type: "application/pdf" } };
  const response = await invokeLLM({
    model,
    messages: [
      { role: "system", content: "당신은 교육 문서 OCR 도우미입니다. 보이는 내용만 정확히 읽고 추정으로 내용을 보완하지 마십시오. 수식·표·번호를 가능한 한 보존하십시오." },
      { role: "user", content: [{ type: "text", text: `파일명: ${input.fileName}\n문서를 OCR하고 검색 가능한 구조로 추출하십시오.` }, filePart] as any },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ocr_document",
        strict: true,
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            plainText: { type: "string" },
            headings: { type: "array", items: { type: "string" } },
            keywords: { type: "array", items: { type: "string" } },
            cautions: { type: "array", items: { type: "string" } },
          },
          required: ["title", "plainText", "headings", "keywords", "cautions"],
          additionalProperties: false,
        },
      },
    },
  });
  const data = JSON.parse(contentOf(response));
  return { ...data, model, extractionMethod: input.mimeType === "application/pdf" ? "vision_pdf" : "vision_image" } as { title: string; plainText: string; headings: string[]; keywords: string[]; cautions: string[]; model: string; extractionMethod: "vision_pdf" | "vision_image" };
}

export async function generateDraft(input: {
  subject: string;
  unit: string;
  difficulty: string;
  questionType: string;
  points: number;
  additionalRequirements?: string;
  curriculumContext: string;
  referenceContext: string;
  guidelineContext: string;
}) {
  const model = await selectModel("generation");
  if (!model) throw new Error("사용 가능한 AI 모델을 찾을 수 없습니다.");
  const response = await invokeLLM({
    model,
    messages: [
      { role: "system", content: "당신은 고등학교 평가 문항 초안을 만드는 출제 보조 AI입니다. 제공된 근거 밖의 사실을 쓰지 말고, 기출 문항의 문장·수치·선지 구성을 복제하지 마십시오. 교사가 최종 검수하는 초안이며, 출제 의도와 정답·해설이 논리적으로 일치해야 합니다." },
      { role: "user", content: `요청 조건\n- 과목: ${input.subject}\n- 단원: ${input.unit}\n- 난이도: ${input.difficulty}\n- 유형: ${input.questionType}\n- 배점: ${input.points}점\n- 추가 요구: ${input.additionalRequirements || "없음"}\n\n[교육과정 근거]\n${input.curriculumContext || "등록된 교육과정 근거 없음"}\n\n[기출 유형 근거]\n${input.referenceContext || "등록된 기출 근거 없음"}\n\n[출제 지침 근거]\n${input.guidelineContext || "등록된 출제 지침 근거 없음"}\n\n위 근거로 새로운 선택형 문항 1개를 작성하십시오.` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "question_draft",
        strict: true,
        schema: {
          type: "object",
          properties: {
            questionText: { type: "string" },
            choices: { type: "array", items: { type: "string" } },
            answer: { type: "string" },
            explanation: { type: "string" },
            intent: { type: "string" },
            usedConcepts: { type: "array", items: { type: "string" } },
          },
          required: ["questionText", "choices", "answer", "explanation", "intent", "usedConcepts"],
          additionalProperties: false,
        },
      },
    },
  });
  return { draft: JSON.parse(contentOf(response)) as Draft, model };
}

export async function validateDraft(input: { draft: Draft; subject: string; unit: string; difficulty: string; curriculumContext: string; guidelineContext: string; similarityScore: number; similarReferenceId: number | null; similarReference?: { questionText: string; choices: string[] | null; intent: string } }) {
  const model = await selectModel("validation");
  if (!model) throw new Error("사용 가능한 AI 모델을 찾을 수 없습니다.");
  const response = await invokeLLM({
    model,
    messages: [
      { role: "system", content: "당신은 엄격한 고등학교 시험문항 검증자입니다. 모호하거나 근거가 부족한 경우 false로 판정하십시오. 답과 해설의 논리적 일치, 요구 난이도 적합성, 단원 범위와 출제 지침 준수를 검사합니다." },
      { role: "user", content: `과목: ${input.subject}\n단원: ${input.unit}\n목표 난이도: ${input.difficulty}\n교육과정 근거: ${input.curriculumContext || "없음"}\n출제 지침 근거: ${input.guidelineContext || "없음"}\n\n[생성 문항]\n문항: ${input.draft.questionText}\n보기: ${(input.draft.choices ?? []).join(" | ")}\n정답: ${input.draft.answer}\n해설: ${input.draft.explanation}\n출제 의도: ${input.draft.intent}\n\n[가장 가까운 기출문제]\n문항: ${input.similarReference?.questionText || "없음"}\n보기: ${(input.similarReference?.choices || []).join(" | ")}\n출제 의도: ${input.similarReference?.intent || "없음"}\n\n두 문항이 문장·수치·자료구성·사고 과정까지 실질적으로 동일하거나 지나치게 유사하면 tooSimilar를 true로 판정하십시오.` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "validation_result",
        strict: true,
        schema: {
          type: "object",
          properties: {
            inScope: { type: "boolean" },
            answerExplanationConsistent: { type: "boolean" },
            difficultyAppropriate: { type: "boolean" },
            guidanceCompliant: { type: "boolean" },
            tooSimilar: { type: "boolean" },
            notes: { type: "array", items: { type: "string" } },
          },
          required: ["inScope", "answerExplanationConsistent", "difficultyAppropriate", "guidanceCompliant", "tooSimilar", "notes"],
          additionalProperties: false,
        },
      },
    },
  });
  const judged = JSON.parse(contentOf(response));
  const pass = Boolean(judged.inScope && judged.answerExplanationConsistent && judged.difficultyAppropriate && judged.guidanceCompliant && !judged.tooSimilar && input.similarityScore < 0.84);
  return { ...judged, similarityScore: input.similarityScore, similarReferenceId: input.similarReferenceId, pass, model } as Validation & { model: string };
}
