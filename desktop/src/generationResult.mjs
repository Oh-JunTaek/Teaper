/** 생성 모델의 안내 문구와 문항 본문을 분리하고, 선택형 시각 자료 명세를 안전하게 꺼낸다. */
export function extractGenerationPresentation(raw) {
  let text = String(raw || "").trim();
  let visualSpec = null;
  const visualMatch = text.match(/\[시각자료\]\s*```json\s*([\s\S]*?)\s*```\s*\[\/시각자료\]/i);
  if (visualMatch) {
    try {
      const parsed = JSON.parse(visualMatch[1]);
      if (parsed && (parsed.kind === "graph" || parsed.kind === "table")) visualSpec = parsed;
    } catch { /* 모델이 구조화된 시각 자료를 완성하지 못하면 본문만 보존한다. */ }
    text = text.replace(visualMatch[0], "").trim();
  }
  const questionStart = text.search(/(^|\n)#{2,3}\s*(문항|question)(?:\s|$)/i);
  if (questionStart >= 0) text = text.slice(questionStart).trim();
  return { text, visualSpec };
}

const escapeHtml = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const subscript = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" };
const superscript = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" };

export function readableMath(value) {
  const toSubscript = digits => String(digits).split("").map(digit => subscript[digit] || digit).join("");
  const toSuperscript = digits => String(digits).split("").map(digit => superscript[digit] || digit).join("");
  const normalizeFormula = formula => formula.replace(/([A-Z][a-z]?)(\d+)/g, (_match, symbol, digits) => `${symbol}${toSubscript(digits)}`);
  return String(value || "").replace(/\$([^$]+)\$/g, "$1").replace(/\\text\{([^}]+)\}/g, "$1").replace(/\\delta\^\{?(-|\+)\}?/g, (_match, sign) => sign === "-" ? "δ⁻" : "δ⁺").replace(/\\circ/g, "°").replace(/_\{?([0-9]+)\}?/g, (_match, digits) => toSubscript(digits)).replace(/\^\{?([0-9+-]+)\}?/g, (_match, digits) => toSuperscript(digits)).replace(/\b(?:[A-Z][a-z]?\d*){2,}\b/g, normalizeFormula).replace(/\b((?:[A-Z][a-z]?\d*)+)([+-])(?=\s|$|[),.?!])/g, (_match, formula, charge) => `${normalizeFormula(formula)}${toSuperscript(charge)}`).replace(/\b(\d+[spdfg])(\d+)\b/g, (_match, orbital, digits) => `${orbital}${toSuperscript(digits)}`);
}

/** 브라우저에서 외부 라이브러리 없이 교사용 생성 결과의 핵심 Markdown과 수식을 읽기 좋게 표시한다. */
export function teacherReadableHtml(text) {
  const escaped = readableMath(escapeHtml(text)).replace(/\$\$?([^$]+)\$\$?/g, "<span class=\"inline-formula\">$1</span>");
  return escaped.split(/\n{2,}/).map(block => {
    const line = block.trim();
    if (!line || /^---+$/.test(line)) return "";
    if (/^#{2,4}\s+/.test(line)) return `<h3>${line.replace(/^#{2,4}\s+/, "").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}</h3>`;
    const rich = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
    return `<p>${rich}</p>`;
  }).join("");
}

export function visualSpecHtml(spec) {
  if (spec?.kind === "table" && Array.isArray(spec.columns) && Array.isArray(spec.rows)) return `<section class="generation-visual"><h3>${escapeHtml(spec.title || "표")}</h3><table><thead><tr>${spec.columns.map(column => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${spec.rows.map(row => `<tr>${spec.columns.map((_, index) => `<td>${escapeHtml(Array.isArray(row) ? row[index] : "")}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`;
  if (spec?.kind === "graph" && Array.isArray(spec.series)) {
    const points = spec.series.flatMap(series => Array.isArray(series.points) ? series.points : []).filter(point => Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)));
    if (!points.length) return "";
    const xs = points.map(point => Number(point.x)); const ys = points.map(point => Number(point.y)); const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys); const sx = value => 54 + ((Number(value) - minX) / (maxX - minX || 1)) * 470; const sy = value => 230 - ((Number(value) - minY) / (maxY - minY || 1)) * 180;
    const colors = ["#15856b", "#2d6496", "#b56716", "#7b56b3"];
    const lines = spec.series.map((series, index) => `<polyline fill="none" stroke="${series.color || colors[index % colors.length]}" stroke-width="3" points="${(series.points || []).map(point => `${sx(point.x).toFixed(1)},${sy(point.y).toFixed(1)}`).join(" ")}"/><text x="64" y="${32 + index * 18}" fill="${series.color || colors[index % colors.length]}" font-size="13">${escapeHtml(series.name || `자료 ${index + 1}`)}</text>`).join("");
    return `<section class="generation-visual"><h3>${escapeHtml(spec.title || "그래프")}</h3><svg viewBox="0 0 560 270" role="img" aria-label="${escapeHtml(spec.title || "그래프")}"><line x1="54" y1="230" x2="530" y2="230" stroke="#64748b"/><line x1="54" y1="28" x2="54" y2="230" stroke="#64748b"/>${lines}<text x="270" y="260" text-anchor="middle" fill="#475569" font-size="13">${escapeHtml(spec.xAxis?.label || "x")}</text><text x="14" y="132" fill="#475569" font-size="13">${escapeHtml(spec.yAxis?.label || "y")}</text></svg></section>`;
  }
  return "";
}
