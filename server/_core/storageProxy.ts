import type { Express } from "express";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { hasPilotAccess } from "../services/pilotAccess";

// 로그인 전에도 제공해야 하는 Windows 테스트 설치 파일만 예외적으로 공개합니다.
const PUBLIC_STORAGE_KEYS = new Set([
  "teacher-assessment-local-test-0.1.0-beta.4-setup_c39f6aad.exe",
]);

/** 교사별 불투명 저장 키의 소유자 구간만 현재 로그인 사용자에게 허용합니다. */
export function canAccessProtectedStorageKey(key: string, userId: number) {
  if (!Number.isInteger(userId) || userId <= 0) return false;
  return (
    key.startsWith(`teacher-assessment/${userId}/materials/`) ||
    key.startsWith(`reference-pdfs/${userId}/`)
  );
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    // 교사 자료·기출 원본은 로그인과 파일럿 초대 세션, 사용자별 키 소유 구간을 모두 확인한 뒤에만 서명 URL을 발급합니다.
    if (!PUBLIC_STORAGE_KEYS.has(key)) {
      try {
        const user = await sdk.authenticateRequest(req);
        const hasAccess = await hasPilotAccess(req);
        if (!hasAccess || !canAccessProtectedStorageKey(key, user.id)) {
          res.status(403).send("Storage access denied");
          return;
        }
      } catch {
        res.status(403).send("Storage access denied");
        return;
      }
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
