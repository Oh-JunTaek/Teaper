import { createHash, randomUUID } from "crypto";

// 한글 파일명은 표시용으로 DB에 보존하고, 저장소에는 ASCII 안전 키만 전달합니다.
export function createReferenceStorageKey(userId: number, fileName: string) {
  const extension = fileName.toLowerCase().endsWith(".pdf") ? ".pdf" : "";
  const digest = createHash("sha256").update(fileName).digest("hex").slice(0, 12);
  return `reference-pdfs/${userId}/${Date.now()}-${randomUUID()}-${digest}${extension}`;
}
