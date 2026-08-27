import type { User } from "../../drizzle/schema";

export type MembershipPlan = "basic" | "plus";

export const membershipPlanLabels: Record<MembershipPlan, string> = {
  basic: "교사 기본",
  plus: "교사 플러스",
};

// 결제·가격이 확정되기 전 파일럿용 포함량입니다. 실제 출시 전 익명 운영 원가를 검토해 조정합니다.
export const managedAiMonthlySuccessLimits: Record<MembershipPlan, number> = {
  basic: 3,
  plus: 30,
};

// 운영 관리자와 플러스 플랜 모두 문제집 출력 패키지를 사용할 수 있습니다.
export function hasPlusPlan(user: Pick<User, "role" | "membershipPlan">) {
  return user.role === "admin" || user.membershipPlan === "plus";
}

export function membershipPlanSummary(user: Pick<User, "role" | "membershipPlan">, managedAiSuccessCount = 0, usageMonth?: string) {
  const plan: MembershipPlan = hasPlusPlan(user) ? "plus" : "basic";
  const managedAiMonthlySuccessLimit = user.role === "admin" ? Number.MAX_SAFE_INTEGER : managedAiMonthlySuccessLimits[plan];
  return {
    plan,
    label: membershipPlanLabels[plan],
    canUseWorkbookExport: plan === "plus",
    // 학생용 시험지의 EunmaStudio 워터마크는 교사 플러스에서만 제거할 수 있다.
    canRemoveStudentWatermark: plan === "plus",
    managedAi: {
      usageMonth: usageMonth || null,
      successCount: Math.max(0, managedAiSuccessCount),
      monthlySuccessLimit: managedAiMonthlySuccessLimit,
      remainingSuccessCount: Math.max(0, managedAiMonthlySuccessLimit - Math.max(0, managedAiSuccessCount)),
    },
  } as const;
}
