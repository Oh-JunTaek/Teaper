import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { checkAllOfficialSources } from "../services/officialSources";

/**
 * Scheduled source monitoring endpoint. It is intentionally cron-only: source
 * changes create review candidates and never publish documents automatically.
 */
export async function runOfficialSourceCheck(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const results = await checkAllOfficialSources();
    return res.json({ ok: true, sourceCount: results.length, results });
  } catch (error) {
    // 예약 작업 실패 시 내부 오류 원문을 외부 응답에 담지 않아 자료·연결 정보가 노출되지 않게 합니다.
    console.error("[OfficialSourceCheck] Scheduled source check failed", error);
    return res.status(500).json({
      error: "공식 출처 변경 확인에 실패했습니다. 잠시 뒤 다시 시도해 주세요.",
      timestamp: new Date().toISOString(),
    });
  }
}
