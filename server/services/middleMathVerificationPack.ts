import { verifyMiddleSchoolCalculation, type CalculationSpec } from "./mathVerification";

// 중등 수학 제한 파일럿에서 계산 확인기의 회귀를 점검하는 대표 단원 묶음입니다.
// 실제 학생 답안이나 교사 문항을 저장하지 않고, 공개 가능한 기초 계산 조건만 사용합니다.
export const MIDDLE_MATH_VERIFICATION_PACK: Array<{ unit: string; label: string; calculation: CalculationSpec; expectedStatus: "checked_match" }> = [
  { unit: "유리수와 계산", label: "수치 계산", calculation: { kind: "numeric_expression", expression: "(18+6)/4", expectedAnswer: "6" }, expectedStatus: "checked_match" },
  { unit: "일차방정식", label: "일차식", calculation: { kind: "linear_equation", expression: "3*x-4=17", expectedAnswer: "7" }, expectedStatus: "checked_match" },
  { unit: "비례식", label: "비례", calculation: { kind: "proportion", expression: "5/8=x/40", expectedAnswer: "25" }, expectedStatus: "checked_match" },
  { unit: "자료의 정리", label: "평균", calculation: { kind: "basic_statistics", expression: "mean(6,8,10,12)", expectedAnswer: "9" }, expectedStatus: "checked_match" },
];

export function runMiddleMathVerificationPack() {
  return MIDDLE_MATH_VERIFICATION_PACK.map(item => ({ ...item, result: verifyMiddleSchoolCalculation(item.calculation) }));
}
