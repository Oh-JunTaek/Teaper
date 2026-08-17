export type OfficialDocumentVersionInput = {
  id: number;
  catalogKey: string;
  sourceId: number;
  title: string;
  subject: string;
  unit: string;
  applicableYear: string;
  documentType: "curriculum" | "guideline" | "achievement_standard";
  issueNumber: string | null;
  publishedAt: string | null;
  appliesFrom: string | null;
  appliesTo: string | null;
  rightsStatus: "link_only" | "rights_review" | "approved_for_rag";
  summary: string;
  isDefault: number;
};

export type OfficialChangeVersionInput = { id: number; documentUrl: string; title: string; snapshot: unknown };

export function buildApprovedOfficialDocumentVersion(document: OfficialDocumentVersionInput, change: OfficialChangeVersionInput, reviewNote: string, reviewedAt: Date) {
  const date = reviewedAt.toISOString().slice(0, 10);
  return {
    catalogKey: `${document.catalogKey}-change-${change.id}`,
    sourceId: document.sourceId,
    previousDocumentId: document.id,
    title: `${document.title} · 확인본 ${date}`,
    subject: document.subject,
    unit: document.unit,
    applicableYear: document.applicableYear,
    documentType: document.documentType,
    officialUrl: change.documentUrl,
    issueNumber: document.issueNumber,
    publishedAt: document.publishedAt,
    appliesFrom: document.appliesFrom,
    appliesTo: document.appliesTo,
    rightsStatus: document.rightsStatus,
    catalogStatus: "published" as const,
    summary: `${document.summary}\n\n공식 출처 변경 확인: ${change.title}. 관리자 검토: ${reviewNote}`,
    sourceSnapshot: change.snapshot,
    isDefault: document.isDefault,
    lastVerifiedAt: reviewedAt,
  };
}
