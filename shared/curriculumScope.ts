export type SchoolLevel = "middle" | "high";
export type SubjectGroup = "science" | "mathematics";

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

export function defaultCourse(schoolLevel: SchoolLevel, subjectGroup: SubjectGroup) {
  return listCourses(schoolLevel, subjectGroup)[0].value;
}

export function scopeLabel(schoolLevel: SchoolLevel, subjectGroup: SubjectGroup, subject: string) {
  return `${SCHOOL_LEVEL_OPTIONS.find(item => item.value === schoolLevel)?.label ?? schoolLevel} · ${SUBJECT_GROUP_OPTIONS.find(item => item.value === subjectGroup)?.label ?? subjectGroup} · ${subject}`;
}
