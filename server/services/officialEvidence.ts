type OfficialDocumentForEvidence = {
  id: number;
  title: string;
  applicableYear: string;
  officialUrl: string;
  summary: string;
  rightsStatus: "link_only" | "rights_review" | "approved_for_rag";
};

export function buildOfficialEvidenceContext(documents: OfficialDocumentForEvidence[]) {
  return documents.map(document => {
    const header = `[선택 공식 문서 ${document.id}: ${document.title}]\n적용 범위: ${document.applicableYear}\n공식 출처: ${document.officialUrl}`;
    if (document.rightsStatus === "approved_for_rag") return `${header}\n사용 범위: RAG 본문 근거 사용 승인\n본문 요약: ${document.summary}`;
    if (document.rightsStatus === "rights_review") return `${header}\n사용 범위: 권리 검토 중 — 교사 확인용 요약만 제공, 문항 본문 근거로 사용 금지\n요약: ${document.summary}`;
    return `${header}\n사용 범위: 원문 링크만 제공 — 문항 본문 근거로 사용 금지`;
  }).join("\n\n");
}
