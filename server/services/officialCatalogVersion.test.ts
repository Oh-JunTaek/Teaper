import { describe, expect, it } from "vitest";
import { buildApprovedOfficialDocumentVersion } from "./officialCatalogVersion";

describe("official catalog version approval", () => {
  it("creates a distinct, traceable document version from an approved change", () => {
    const version = buildApprovedOfficialDocumentVersion({ id: 3, catalogKey: "2015-chemistry-one", sourceId: 7, title: "화학 I", subject: "화학 I", unit: "공통", applicableYear: "2026", documentType: "curriculum", issueNumber: "교육부 고시", publishedAt: "2015-09-23", appliesFrom: "2018-03-01", appliesTo: "2027-02-28", rightsStatus: "link_only", summary: "기준 문서", isDefault: 1 }, { id: 18, title: "교육과정 페이지 변경 후보", documentUrl: "https://moe.go.kr/new", snapshot: { pageTitle: "변경됨" } }, "권리와 원문을 확인했습니다.", new Date("2026-08-17T00:00:00Z"));

    expect(version.catalogKey).toBe("2015-chemistry-one-change-18");
    expect(version.officialUrl).toBe("https://moe.go.kr/new");
    expect(version.title).toContain("확인본 2026-08-17");
    expect(version.summary).toContain("권리와 원문을 확인했습니다.");
    expect(version.previousDocumentId).toBe(3);
    expect(version.sourceSnapshot).toEqual({ pageTitle: "변경됨" });
  });
});
