import { describe, expect, it } from "vitest";
import { buildOfficialEvidenceContext } from "./officialEvidence";

describe("official evidence rights policy", () => {
  it("limits link-only documents to citations and provides body context only for approved documents", () => {
    const context = buildOfficialEvidenceContext([
      { id: 1, title: "링크 문서", applicableYear: "2026", officialUrl: "https://example.go.kr/1", summary: "숨겨야 할 요약", rightsStatus: "link_only" },
      { id: 2, title: "승인 문서", applicableYear: "2026", officialUrl: "https://example.go.kr/2", summary: "사용 가능한 요약", rightsStatus: "approved_for_rag" },
    ]);
    expect(context).toContain("원문 링크만 제공");
    expect(context).not.toContain("숨겨야 할 요약");
    expect(context).toContain("RAG 본문 근거 사용 승인");
    expect(context).toContain("사용 가능한 요약");
  });
});
