/**
 * 생성 문항의 시각 자료를 설명문이 아닌 실제 그래프·표로 렌더링합니다.
 * 좌표와 표 값은 문항 생성 시 DB에 저장되어 검수·내보내기 시 같은 자료를 재현할 수 있습니다.
 */
export type QuestionVisualSpec =
  | { kind: "graph"; title: string; xAxis: { label: string; unit?: string }; yAxis: { label: string; unit?: string }; series: Array<{ name: string; color?: string; points: Array<{ x: number; y: number }> }> }
  | { kind: "table"; title: string; columns: string[]; rows: string[][] };

const colors = ["#176B87", "#C46B35", "#6C4CB7", "#168768"];

function GraphVisual({ spec }: { spec: Extract<QuestionVisualSpec, { kind: "graph" }> }) {
  const allPoints = spec.series.flatMap(series => series.points);
  const minX = Math.min(...allPoints.map(point => point.x)); const maxX = Math.max(...allPoints.map(point => point.x));
  const minY = Math.min(...allPoints.map(point => point.y)); const maxY = Math.max(...allPoints.map(point => point.y));
  const width = 640; const height = 320; const margin = { left: 62, right: 24, top: 28, bottom: 56 };
  const plotWidth = width - margin.left - margin.right; const plotHeight = height - margin.top - margin.bottom;
  const rangeX = Math.max(1, maxX - minX); const rangeY = Math.max(1, maxY - minY);
  const x = (value: number) => margin.left + ((value - minX) / rangeX) * plotWidth;
  const y = (value: number) => margin.top + ((maxY - value) / rangeY) * plotHeight;
  const ticks = 5;
  return <figure className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3"><figcaption className="mb-2 text-center text-sm font-semibold text-[#183248]">{spec.title}</figcaption><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={spec.title} className="h-auto w-full"><rect x={margin.left} y={margin.top} width={plotWidth} height={plotHeight} fill="#FBFCFD" stroke="#CBD5E1" />{Array.from({ length: ticks + 1 }, (_, index) => { const value = minY + (rangeY * index) / ticks; return <g key={`y-${index}`}><line x1={margin.left} x2={width - margin.right} y1={y(value)} y2={y(value)} stroke="#E2E8F0" /><text x={margin.left - 8} y={y(value) + 4} textAnchor="end" fontSize="10" fill="#64748B">{value.toFixed(1)}</text></g>; })}{Array.from({ length: ticks + 1 }, (_, index) => { const value = minX + (rangeX * index) / ticks; return <g key={`x-${index}`}><line x1={x(value)} x2={x(value)} y1={margin.top} y2={height - margin.bottom} stroke="#F1F5F9" /><text x={x(value)} y={height - margin.bottom + 16} textAnchor="middle" fontSize="10" fill="#64748B">{value.toFixed(1)}</text></g>; })}<line x1={margin.left} x2={width - margin.right} y1={height - margin.bottom} y2={height - margin.bottom} stroke="#475569" /><line x1={margin.left} x2={margin.left} y1={margin.top} y2={height - margin.bottom} stroke="#475569" />{spec.series.map((series, index) => <g key={series.name}><polyline points={series.points.map(point => `${x(point.x)},${y(point.y)}`).join(" ")} fill="none" stroke={series.color || colors[index % colors.length]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{series.points.map((point, pointIndex) => <circle key={pointIndex} cx={x(point.x)} cy={y(point.y)} r="2.8" fill={series.color || colors[index % colors.length]} />)}</g>)}<text x={margin.left + plotWidth / 2} y={height - 10} textAnchor="middle" fontSize="12" fill="#334155">{spec.xAxis.label}{spec.xAxis.unit ? ` (${spec.xAxis.unit})` : ""}</text><text x="14" y={margin.top + plotHeight / 2} textAnchor="middle" fontSize="12" fill="#334155" transform={`rotate(-90 14 ${margin.top + plotHeight / 2})`}>{spec.yAxis.label}{spec.yAxis.unit ? ` (${spec.yAxis.unit})` : ""}</text>{spec.series.map((series, index) => <g key={`legend-${series.name}`} transform={`translate(${margin.left + index * 110}, 12)`}><line x1="0" x2="16" y1="0" y2="0" stroke={series.color || colors[index % colors.length]} strokeWidth="3" /><text x="22" y="4" fontSize="11" fill="#334155">{series.name}</text></g>)}</svg></figure>;
}

function TableVisual({ spec }: { spec: Extract<QuestionVisualSpec, { kind: "table" }> }) {
  return <figure className="overflow-hidden rounded-xl border border-slate-200 bg-white"><figcaption className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-[#183248]">{spec.title}</figcaption><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-[#F2FBF6] text-[#183248]"><tr>{spec.columns.map(column => <th key={column} className="whitespace-nowrap px-4 py-3 font-semibold">{column}</th>)}</tr></thead><tbody>{spec.rows.map((row, index) => <tr key={index} className="border-t border-slate-100">{spec.columns.map((_, cellIndex) => <td key={cellIndex} className="whitespace-nowrap px-4 py-3 text-slate-600">{row[cellIndex] || "—"}</td>)}</tr>)}</tbody></table></div></figure>;
}

export function QuestionVisual({ spec }: { spec?: QuestionVisualSpec | null }) {
  if (!spec) return null;
  return spec.kind === "graph" ? <GraphVisual spec={spec} /> : <TableVisual spec={spec} />;
}
