import { Label } from "@/components/ui/label";
import { courseReadiness, defaultCourse, filterCoursesByReadiness, listCourses, SCHOOL_LEVEL_OPTIONS, SUBJECT_GROUP_OPTIONS, type CourseReadiness, type SchoolLevel, type SubjectGroup } from "@shared/curriculumScope";

type Props = {
  schoolLevel: SchoolLevel;
  subjectGroup: SubjectGroup;
  subject: string;
  onChange: (next: { schoolLevel: SchoolLevel; subjectGroup: SubjectGroup; subject: string }) => void;
  readinessFilter?: "all" | CourseReadiness["status"];
  onReadinessFilterChange?: (value: "all" | CourseReadiness["status"]) => void;
};

// 학교급·교과·과목과 파일럿 준비 상태를 한 곳에서 선택하도록 제공하는 공통 입력입니다.
export function CurriculumScopeSelect({ schoolLevel, subjectGroup, subject, onChange, readinessFilter, onReadinessFilterChange }: Props) {
  const courses = listCourses(schoolLevel, subjectGroup);
  const visibleCourses = filterCoursesByReadiness(schoolLevel, subjectGroup, readinessFilter || "all");
  const readiness = courseReadiness(subject);
  const readinessClass = readiness.status === "ready"
    ? "border-[#9CCFC0] bg-[#E6F4EE] text-[#116B58]"
    : readiness.status === "pilot"
      ? "border-[#F3D6A3] bg-[#FFF9EC] text-[#8A5A19]"
      : "border-slate-200 bg-slate-100 text-slate-600";
  const gridColumns = onReadinessFilterChange ? "sm:grid-cols-4" : "sm:grid-cols-3";
  const wideColumn = onReadinessFilterChange ? "sm:col-span-4" : "sm:col-span-3";

  return (
    <div className={`grid gap-3 rounded-xl border border-[#D6EBE2] bg-[#F7FCF9] p-4 ${gridColumns}`}>
      <div>
        <Label>학교급</Label>
        <select value={schoolLevel} onChange={event => {
          const nextLevel = event.target.value as SchoolLevel;
          onChange({ schoolLevel: nextLevel, subjectGroup, subject: defaultCourse(nextLevel, subjectGroup) });
        }} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
          {SCHOOL_LEVEL_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div>
        <Label>교과</Label>
        <select value={subjectGroup} onChange={event => {
          const nextGroup = event.target.value as SubjectGroup;
          onChange({ schoolLevel, subjectGroup: nextGroup, subject: defaultCourse(schoolLevel, nextGroup) });
        }} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
          {SUBJECT_GROUP_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div>
        <Label>과목</Label>
        <select value={visibleCourses.some(course => course.value === subject) ? subject : ""} onChange={event => onChange({ schoolLevel, subjectGroup, subject: event.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
          {visibleCourses.length ? visibleCourses.map(course => <option key={course.value} value={course.value}>{course.label}</option>) : <option value="">해당 상태의 과목 없음</option>}
        </select>
      </div>
      {onReadinessFilterChange ? <div>
        <Label>준비 상태</Label>
        <select value={readinessFilter || "all"} onChange={event => {
          const nextFilter = event.target.value as "all" | CourseReadiness["status"];
          onReadinessFilterChange(nextFilter);
          const nextCourses = filterCoursesByReadiness(schoolLevel, subjectGroup, nextFilter);
          if (nextCourses.length && !nextCourses.some(course => course.value === subject)) {
            onChange({ schoolLevel, subjectGroup, subject: nextCourses[0].value });
          }
        }} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
          <option value="all">전체</option>
          <option value="ready">파일럿 검증</option>
          <option value="pilot">제한 파일럿</option>
          <option value="preparing">준비 중</option>
        </select>
      </div> : null}
      <div className={`${wideColumn} rounded-lg border px-3 py-2 text-xs leading-5 ${readinessClass}`}>
        <strong>{readiness.label}</strong><span className="ml-2">{readiness.detail}</span>
      </div>
      <p className={`${wideColumn} text-xs leading-5 text-slate-500`}>선택한 학교급·교과·과목에 맞는 공식 문서만 아래에 표시됩니다. 실제 학교 편성 및 시험 범위는 학교 교육과정과 교사 자료로 확인해 주세요.</p>
    </div>
  );
}
