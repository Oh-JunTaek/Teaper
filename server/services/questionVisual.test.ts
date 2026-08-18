import { describe, expect, it } from "vitest";
import { buildQuestionVisual } from "./assessmentAi";

describe("buildQuestionVisual", () => {
  it("퍼텐셜 에너지 그래프에 X·Y 곡선과 축 데이터를 만든다", () => {
    const visual = buildQuestionVisual({ questionType: "그래프 해석형", unit: "화학 결합", additionalRequirements: "원자 간 거리와 퍼텐셜 에너지 결합 X, Y를 비교" });
    expect(visual).toMatchObject({ kind: "graph", xAxis: { unit: "r" }, yAxis: { unit: "PE" } });
    if (!visual || visual.kind !== "graph") throw new Error("그래프가 생성되어야 합니다.");
    const xMin = Math.min(...visual.series[0].points.map(point => point.y));
    const yMin = Math.min(...visual.series[1].points.map(point => point.y));
    expect(xMin).toBeLessThan(yMin);
  });

  it("실험 자료형은 실제 행·열을 가진 표 자료를 만든다", () => {
    const visual = buildQuestionVisual({ questionType: "실험 자료형", unit: "화학 반응", additionalRequirements: "" });
    expect(visual).toMatchObject({ kind: "table", columns: expect.any(Array), rows: expect.any(Array) });
  });
});
