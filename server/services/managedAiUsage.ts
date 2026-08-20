export type ManagedAiOperation = "generation" | "validation" | "vision_extract";
export type ManagedAiOutcome = "success" | "failure" | "limited";
export type ManagedAiDurationBucket = "under_5s" | "5_to_15s" | "15_to_45s" | "over_45s";

export function managedAiUsageDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value || "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function managedAiDurationBucket(durationMs: number): ManagedAiDurationBucket {
  if (durationMs < 5_000) return "under_5s";
  if (durationMs < 15_000) return "5_to_15s";
  if (durationMs < 45_000) return "15_to_45s";
  return "over_45s";
}

export function managedAiOutcomeFromError(error: unknown): ManagedAiOutcome {
  const message = error instanceof Error ? error.message : String(error || "");
  return /\b429\b|too.?many|rate.?limit|quota/i.test(message) ? "limited" : "failure";
}

export type ManagedAiUsageEntry = {
  usageDate: string;
  operation: ManagedAiOperation;
  outcome: ManagedAiOutcome;
  model: string;
  durationBucket: ManagedAiDurationBucket;
  knownInputTokens?: number;
  knownOutputTokens?: number;
};

// 사용 주체, 요청 본문, 파일명, 문항, IP 등을 의도적으로 받지 않는 순수 집계 입력입니다.
export function createManagedAiUsageEntry(input: Omit<ManagedAiUsageEntry, "usageDate" | "durationBucket"> & { durationMs: number; at?: Date }): ManagedAiUsageEntry {
  return {
    usageDate: managedAiUsageDate(input.at),
    operation: input.operation,
    outcome: input.outcome,
    model: input.model || "managed-default",
    durationBucket: managedAiDurationBucket(input.durationMs),
    knownInputTokens: Math.max(0, input.knownInputTokens || 0),
    knownOutputTokens: Math.max(0, input.knownOutputTokens || 0),
  };
}
