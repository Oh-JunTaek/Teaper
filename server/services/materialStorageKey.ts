import { randomUUID } from "node:crypto";

function safeExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) return "";
  const extension = fileName.slice(dotIndex);
  return /^\.[A-Za-z0-9]{1,12}$/.test(extension) ? extension.toLowerCase() : "";
}

/**
 * Storage presign endpoints accept only ASCII paths. The original filename stays
 * in the database for display; this key is intentionally opaque and ASCII-only.
 */
export function createMaterialStorageKey(ownerId: number, originalFileName: string, id = randomUUID()) {
  if (!Number.isInteger(ownerId) || ownerId <= 0) throw new Error("유효한 자료 소유자 ID가 필요합니다.");
  return `teacher-assessment/${ownerId}/materials/${id}${safeExtension(originalFileName)}`;
}
