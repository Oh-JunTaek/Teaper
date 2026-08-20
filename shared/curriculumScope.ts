export type SchoolLevel = "middle" | "high";
export type SubjectGroup = "science" | "mathematics";
export type CourseReadiness = { status: "ready" | "pilot" | "preparing"; label: string; detail: string };

export const SCHOOL_LEVEL_OPTIONS: Array<{ value: SchoolLevel; label: string }> = [
  { value: "middle", label: "중학교" },
  { value: "high", label: "고등학교" },
];

export const SUBJECT_GROUP_OPTIONS: Array<{ value: SubjectGroup; label: string }> = [
  { value: "science", label: "과학" },
  { value: "mathematics", label: "수학" },
];

const courses: Record<SchoolLevel, Record<SubjectGroup, Array<{ value: string; label: string }>>> = {
  middle: {
    science: [{ value: "중등 과학", label: "중등 과학" }],
    mathematics: [{ value: "중등 수학", label: "중등 수학" }],
  },
  high: {
    science: [
      { value: "통합과학1", label: "통합과학1" },
      { value: "통합과학2", label: "통합과학2" },
      { value: "과학탐구실험1", label: "과학탐구실험1" },
      { value: "과학탐구실험2", label: "과학탐구실험2" },
      { value: "물리학", label: "물리학" },
      { value: "화학", label: "화학" },
      { value: "생명과학", label: "생명과학" },
      { value: "지구과학", label: "지구과학" },
      { value: "화학 I", label: "화학 I · 2015 개정 파일럿" },
    ],
    mathematics: [
      { value: "공통수학1", label: "공통수학1" },
      { value: "공통수학2", label: "공통수학2" },
      { value: "대수", label: "대수" },
      { value: "미적분Ⅰ", label: "미적분Ⅰ" },
      { value: "확률과 통계", label: "확률과 통계" },
    ],
  },
};

export function listCourses(schoolLevel: SchoolLevel, subjectGroup: SubjectGroup) {
  return courses[schoolLevel][subjectGroup];
}

// 준비 상태 필터는 화면 표시만 정리하며, 서버의 과목별 생성 허용 규칙과는 별개입니다.
export function filterCoursesByReadiness(
  schoolLevel: SchoolLevel,
  subjectGroup: SubjectGroup,
  readiness: "all" | CourseReadiness["status"],
) {
  const availableCourses = listCourses(schoolLevel, subjectGroup);
  return readiness === "all" ? availableCourses : availableCourses.filter(course => courseReadiness(course.value).status === readiness);
}

export function defaultCourse(schoolLevel: SchoolLevel, subjectGroup: SubjectGroup) {
  return listCourses(schoolLevel, subjectGroup)[0].value;
}

export function scopeLabel(schoolLevel: SchoolLevel, subjectGroup: SubjectGroup, subject: string) {
  return `${SCHOOL_LEVEL_OPTIONS.find(item => item.value === schoolLevel)?.label ?? schoolLevel} · ${SUBJECT_GROUP_OPTIONS.find(item => item.value === subjectGroup)?.label ?? subjectGroup} · ${subject}`;
}

export function courseReadiness(subject: string): CourseReadiness {
  if (subject === "화학 I") return { status: "ready", label: "파일럿 검증", detail: "화학 I 기존 파일럿 흐름과 공식 문서·검수 기준이 준비되어 있습니다." };
  if (["중등 과학", "중등 수학", "통합과학1", "통합과학2", "과학탐구실험1", "과학탐구실험2", "화학", "공통수학1", "공통수학2"].includes(subject)) return { status: "pilot", label: "제한 파일럿", detail: "공식 문서와 자료 기반 생성은 사용할 수 있으나, 교사 최종 검수와 파일럿 검증이 필요합니다." };
  return { status: "preparing", label: "준비 중", detail: "공식 문서는 준비 중이거나 범위 검수 전입니다. 자료 등록과 공식 문서 확인만 먼저 이용해 주세요." };
}
