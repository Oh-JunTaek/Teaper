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
    return res.status(500).json({
      error: error instanceof Error ? error.message : "공식 출처 변경 확인에 실패했습니다.",
      timestamp: new Date().toISOString(),
    });
  }
}
