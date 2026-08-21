import { AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";

export type ExportVisualSpec =
  | { kind: "graph"; title: string; xAxis: { label: string; unit?: string }; yAxis: { label: string; unit?: string }; series: Array<{ name: string; color?: string; points: Array<{ x: number; y: number }> }> }
  | { kind: "table"; title: string; columns: string[]; rows: string[][] };

export type ExportQuestion = {
  id: number;
  questionText: string;
  choices?: string[] | null;
  answer: string;
  explanation: string;
  intent: string;
  difficulty: string;
  points: number;
  questionType: string;
  visualSpec?: ExportVisualSpec | null;
};

export type QuestionDocumentKind = "question-paper" | "answer-sheet";

const graphWidth = 560;
const graphHeight = 280;
const transparentPng = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLqpgAAAABJRU5ErkJggg=="), character => character.charCodeAt(0));

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

function isGraphVisual(value: ExportVisualSpec | null | undefined): value is Extract<ExportVisualSpec, { kind: "graph" }> {
  return value?.kind === "graph";
}

function isTableVisual(value: ExportVisualSpec | null | undefined): value is Extract<ExportVisualSpec, { kind: "table" }> {
  return value?.kind === "table";
}

// 그래프 데이터는 문서에서도 같은 축·곡선 관계를 확인할 수 있도록 SVG로 재현합니다.
function graphToSvg(spec: Extract<ExportVisualSpec, { kind: "graph" }>) {
  const allPoints = spec.series.flatMap(series => series.points);
  const xValues = allPoints.map(point => point.x);
  const yValues = allPoints.map(point => point.y);
  const xMin = Math.min(...xValues, 0);
  const xMax = Math.max(...xValues, 1);
  const yMin = Math.min(...yValues, 0);
  const yMax = Math.max(...yValues, 1);
  const pad = { left: 56, right: 24, top: 34, bottom: 48 };
  const plotWidth = graphWidth - pad.left - pad.right;
  const plotHeight = graphHeight - pad.top - pad.bottom;
  const scaleX = (value: number) => pad.left + ((value - xMin) / (xMax - xMin || 1)) * plotWidth;
  const scaleY = (value: number) => pad.top + plotHeight - ((value - yMin) / (yMax - yMin || 1)) * plotHeight;
  const xAxis = `${escapeXml(spec.xAxis.label)}${spec.xAxis.unit ? ` (${escapeXml(spec.xAxis.unit)})` : ""}`;
  const yAxis = `${escapeXml(spec.yAxis.label)}${spec.yAxis.unit ? ` (${escapeXml(spec.yAxis.unit)})` : ""}`;
  const lines = spec.series.map((series, index) => {
    const color = series.color || ["#15856B", "#2D6496", "#B56716", "#7B56B3"][index % 4];
    const points = series.points.map(point => `${scaleX(point.x).toFixed(1)},${scaleY(point.y).toFixed(1)}`).join(" ");
    return `<polyline fill="none" stroke="${escapeXml(color)}" stroke-width="3" points="${points}"/><text x="${pad.left + 8}" y="${pad.top + 18 + index * 18}" fill="${escapeXml(color)}" font-size="13" font-family="Arial, sans-serif">${escapeXml(series.name)}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${graphWidth}" height="${graphHeight}" viewBox="0 0 ${graphWidth} ${graphHeight}"><rect width="100%" height="100%" fill="#ffffff"/><text x="${graphWidth / 2}" y="20" text-anchor="middle" fill="#183248" font-size="15" font-weight="700" font-family="Arial, sans-serif">${escapeXml(spec.title)}</text><line x1="${pad.left}" y1="${pad.top + plotHeight}" x2="${pad.left + plotWidth}" y2="${pad.top + plotHeight}" stroke="#334155" stroke-width="1.5"/><line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + plotHeight}" stroke="#334155" stroke-width="1.5"/><text x="${pad.left + plotWidth / 2}" y="${graphHeight - 12}" text-anchor="middle" fill="#475569" font-size="12" font-family="Arial, sans-serif">${xAxis}</text><text x="14" y="${pad.top + plotHeight / 2}" transform="rotate(-90 14 ${pad.top + plotHeight / 2})" text-anchor="middle" fill="#475569" font-size="12" font-family="Arial, sans-serif">${yAxis}</text>${lines}</svg>`;
}

function visualBlocks(spec: ExportVisualSpec | null | undefined) {
  if (isGraphVisual(spec)) {
    return [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 120 }, children: [new ImageRun({ data: new TextEncoder().encode(graphToSvg(spec)), type: "svg", fallback: { data: transparentPng, type: "png" }, transformation: { width: graphWidth, height: graphHeight } })] })];
  }
  if (isTableVisual(spec)) {
    const header = new TableRow({ children: spec.columns.map(column => new TableCell({ shading: { fill: "E6F4EE" }, children: [new Paragraph({ children: [new TextRun({ text: column, bold: true })] })] })) });
    const rows = spec.rows.map(row => new TableRow({ children: spec.columns.map((_, index) => new TableCell({ children: [new Paragraph(row[index] || "")] })) }));
    return [new Paragraph({ text: spec.title, heading: HeadingLevel.HEADING_3, spacing: { before: 120, after: 80 } }), new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] })];
  }
  return [];
}

function questionBlocks(question: ExportQuestion, index: number, kind: QuestionDocumentKind) {
  const showAnswers = kind === "answer-sheet";
  const blocks = [
    new Paragraph({ spacing: { before: index === 1 ? 0 : 280, after: 120 }, children: [new TextRun({ text: `${index}. `, bold: true, size: 24 }), new TextRun({ text: question.questionText, size: 22 })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `${question.questionType} · 난이도 ${question.difficulty} · ${question.points}점`, color: "475569", size: 18 })] }),
    ...(question.choices || []).map((choice, choiceIndex) => new Paragraph({ indent: { left: 360 }, spacing: { after: 60 }, children: [new TextRun({ text: `${"①②③④⑤"[choiceIndex] || `${choiceIndex + 1}.`} ${choice}`, size: 21 })] })),
    ...visualBlocks(question.visualSpec),
  ];
  if (showAnswers) {
    blocks.push(
      new Paragraph({ spacing: { before: 120, after: 50 }, children: [new TextRun({ text: "정답  ", bold: true, color: "15856B" }), new TextRun({ text: question.answer, bold: true })] }),
      new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: "해설  ", bold: true, color: "183248" }), new TextRun(question.explanation)] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "출제 의도  ", bold: true, color: "183248" }), new TextRun(question.intent)] }),
    );
  }
  return blocks;
}

export async function createQuestionDocx(questions: ExportQuestion[], kind: QuestionDocumentKind) {
  const title = kind === "question-paper" ? "문항 시험지" : "정답 및 해설지";
  const document = new Document({
    sections: [{
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: title, bold: true, size: 34, color: "183248" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 320 }, children: [new TextRun({ text: `${questions.length}문항 · 교사 최종 검수 후 실제 시험 범위와 다시 대조하세요.`, size: 18, color: "64748B" })] }),
        ...questions.flatMap((question, index) => questionBlocks(question, index + 1, kind)),
      ],
    }],
  });
  return Packer.toBlob(document);
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

function visualHtml(spec: ExportVisualSpec | null | undefined) {
  if (isGraphVisual(spec)) return `<div class="visual graph">${graphToSvg(spec)}</div>`;
  if (isTableVisual(spec)) return `<section class="visual"><h3>${escapeHtml(spec.title)}</h3><table><thead><tr>${spec.columns.map(column => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${spec.rows.map(row => `<tr>${spec.columns.map((_, index) => `<td>${escapeHtml(row[index] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`;
  return "";
}

// 브라우저의 인쇄 대화상자를 사용해 교사가 프린터 또는 'PDF로 저장'을 직접 선택합니다.
export function openQuestionPrintView(questions: ExportQuestion[], kind: QuestionDocumentKind) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;
  printWindow.opener = null;
  const title = kind === "question-paper" ? "문항 시험지" : "정답 및 해설지";
  const includeAnswer = kind === "answer-sheet";
  const items = questions.map((question, index) => `<article><h2>${index + 1}. ${escapeHtml(question.questionText)}</h2><p class="meta">${escapeHtml(question.questionType)} · 난이도 ${escapeHtml(question.difficulty)} · ${question.points}점</p>${(question.choices || []).map((choice, choiceIndex) => `<p class="choice">${"①②③④⑤"[choiceIndex] || `${choiceIndex + 1}.`} ${escapeHtml(choice)}</p>`).join("")}${visualHtml(question.visualSpec)}${includeAnswer ? `<section class="answer"><p><strong>정답</strong> ${escapeHtml(question.answer)}</p><p><strong>해설</strong> ${escapeHtml(question.explanation)}</p><p><strong>출제 의도</strong> ${escapeHtml(question.intent)}</p></section>` : ""}</article>`).join("");
  printWindow.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4;margin:18mm}body{font-family:"Noto Sans KR",Arial,sans-serif;color:#172033;line-height:1.6}h1{text-align:center;font-size:22px}h2{font-size:14px;white-space:pre-wrap}.meta{font-size:11px;color:#475569}.choice{margin:4px 0 4px 18px}.visual{margin:14px 0;break-inside:avoid}.graph svg{width:100%;height:auto}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #94a3b8;padding:6px;text-align:left}th{background:#e6f4ee}.answer{margin-top:12px;padding:10px 12px;background:#f8fafc;border-left:3px solid #15856b;font-size:12px}article{break-inside:avoid;margin:0 0 25px}@media print{article{page-break-inside:avoid}}</style></head><body><h1>${title}</h1><p style="text-align:center;font-size:11px;color:#64748b">${questions.length}문항 · 내보낸 뒤 실제 시험 범위와 교사 검수 내용을 다시 확인하세요.</p>${items}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 200);
  return true;
}
