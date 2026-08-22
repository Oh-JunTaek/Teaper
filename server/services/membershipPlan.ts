import type { User } from "../../drizzle/schema";

export type MembershipPlan = "basic" | "plus";

export const membershipPlanLabels: Record<MembershipPlan, string> = {
  basic: "교사 기본",
  plus: "교사 플러스",
};

// 운영 관리자와 플러스 플랜 모두 문제집 출력 패키지를 사용할 수 있습니다.
export function hasPlusPlan(user: Pick<User, "role" | "membershipPlan">) {
  return user.role === "admin" || user.membershipPlan === "plus";
}

export function membershipPlanSummary(user: Pick<User, "role" | "membershipPlan">) {
  const plan: MembershipPlan = hasPlusPlan(user) ? "plus" : "basic";
  return {
    plan,
    label: membershipPlanLabels[plan],
    canUseWorkbookExport: plan === "plus",
  } as const;
}
