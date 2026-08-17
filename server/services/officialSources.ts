import { createHash } from "crypto";
import {
  createOfficialSourceChange,
  getOfficialSource,
  listEnabledOfficialSources,
  updateOfficialSourceCheck,
} from "../db";

const APPROVED_OFFICIAL_HOSTS = new Set([
  "moe.go.kr", "www.moe.go.kr", "ncic.re.kr", "www.ncic.re.kr", "stas.moe.go.kr",
  "sen.go.kr", "pen.go.kr", "ice.go.kr", "gen.go.kr", "dge.go.kr", "dje.go.kr", "use.go.kr", "sje.go.kr",
  "goe.go.kr", "gwe.go.kr", "kwe.go.kr", "cbe.go.kr", "cne.go.kr", "jne.go.kr", "jbe.go.kr", "jje.go.kr", "gne.go.kr",
]);

export function assertAllowedOfficialSourceUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("유효한 공식 출처 URL이 필요합니다."); }
  if (url.protocol !== "https:") throw new Error("공식 출처는 HTTPS URL만 등록할 수 있습니다.");
  if (!APPROVED_OFFICIAL_HOSTS.has(url.hostname)) throw new Error("현재 등록할 수 있는 교육부·NCIC·시도교육청 공식 도메인이 아닙니다.");
  return url;
}

export function normalizePage(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/>\s+/g, ">")
    .replace(/\s+</g, "<")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1_000_000);
}

export function fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function pageTitle(html: string) {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].replace(/\s+/g, " ").trim() || "공식 출처 페이지";
}

export type SourceSyncResult = { sourceId: number; status: "initialized" | "unchanged" | "candidate_created" | "failed"; message: string };

export async function checkOfficialSource(sourceId: number): Promise<SourceSyncResult> {
  const source = await getOfficialSource(sourceId);
  if (!source) throw new Error("공식 출처를 찾을 수 없습니다.");
  if (!source.enabled) return { sourceId, status: "unchanged", message: "비활성 출처입니다." };
  try {
    assertAllowedOfficialSourceUrl(source.listingUrl);
    const response = await fetch(source.listingUrl, {
      headers: { "User-Agent": "TeacherAssessmentAssistant/1.0 official-source-monitor" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`공식 출처 응답 오류 (${response.status})`);
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > 5_000_000) throw new Error("공식 출처 페이지가 변경 감지 허용 크기를 초과했습니다.");
    const raw = await response.text();
    if (raw.length > 5_000_000) throw new Error("공식 출처 페이지가 변경 감지 허용 크기를 초과했습니다.");
    const normalized = normalizePage(raw);
    const currentFingerprint = fingerprint(normalized);
    const checkedAt = new Date();
    if (!source.lastFingerprint) {
      await updateOfficialSourceCheck(source.id, { lastFingerprint: currentFingerprint, lastCheckedAt: checkedAt, lastCheckStatus: "baseline_ready" });
      return { sourceId, status: "initialized", message: "변경 감지 기준값을 저장했습니다." };
    }
    if (source.lastFingerprint === currentFingerprint) {
      await updateOfficialSourceCheck(source.id, { lastCheckedAt: checkedAt, lastCheckStatus: "unchanged" });
      return { sourceId, status: "unchanged", message: "변경된 내용이 없습니다." };
    }
    await createOfficialSourceChange({
      sourceId: source.id,
      title: `${source.title} 페이지 변경 후보`,
      documentUrl: source.listingUrl,
      reason: "공식 출처 페이지의 응답 지문이 변경되었습니다. 원문·권리 상태를 검토한 뒤 반영하세요.",
      fingerprint: currentFingerprint,
      snapshot: { pageTitle: pageTitle(raw), checkedAt: checkedAt.toISOString(), previousFingerprint: source.lastFingerprint, currentFingerprint },
    });
    await updateOfficialSourceCheck(source.id, { lastFingerprint: currentFingerprint, lastCheckedAt: checkedAt, lastCheckStatus: "candidate_created" });
    return { sourceId, status: "candidate_created", message: "변경 후보를 관리자 검토함에 추가했습니다." };
  } catch (error) {
    await updateOfficialSourceCheck(source.id, { lastCheckedAt: new Date(), lastCheckStatus: "failed" });
    return { sourceId, status: "failed", message: error instanceof Error ? error.message : "공식 출처를 확인하지 못했습니다." };
  }
}

export async function checkAllOfficialSources() {
  const sources = await listEnabledOfficialSources();
  return Promise.all(sources.map(source => checkOfficialSource(source.id)));
}
