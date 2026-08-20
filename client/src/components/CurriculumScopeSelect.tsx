import { Label } from "@/components/ui/label";
import { courseReadiness, defaultCourse, listCourses, SCHOOL_LEVEL_OPTIONS, SUBJECT_GROUP_OPTIONS, type SchoolLevel, type SubjectGroup } from "@shared/curriculumScope";

type Props = {
  schoolLevel: SchoolLevel;
  subjectGroup: SubjectGroup;
  subject: string;
  onChange: (next: { schoolLevel: SchoolLevel; subjectGroup: SubjectGroup; subject: string }) => void;
};

export function CurriculumScopeSelect({ schoolLevel, subjectGroup, subject, onChange }: Props) {
  const courses = listCourses(schoolLevel, subjectGroup);
  const readiness = courseReadiness(subject);
  const readinessClass = readiness.status === "ready" ? "border-[#9CCFC0] bg-[#E6F4EE] text-[#116B58]" : readiness.status === "pilot" ? "border-[#F3D6A3] bg-[#FFF9EC] text-[#8A5A19]" : "border-slate-200 bg-slate-100 text-slate-600";
  return <div className="grid gap-3 rounded-xl border border-[#D6EBE2] bg-[#F7FCF9] p-4 sm:grid-cols-3">
    <div><Label>학교급</Label><select value={schoolLevel} onChange={event => { const nextLevel = event.target.value as SchoolLevel; onChange({ schoolLevel: nextLevel, subjectGroup, subject: defaultCourse(nextLevel, subjectGroup) }); }} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm">{SCHOOL_LEVEL_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
    <div><Label>교과</Label><select value={subjectGroup} onChange={event => { const nextGroup = event.target.value as SubjectGroup; onChange({ schoolLevel, subjectGroup: nextGroup, subject: defaultCourse(schoolLevel, nextGroup) }); }} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm">{SUBJECT_GROUP_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
    <div><Label>과목</Label><select value={subject} onChange={event => onChange({ schoolLevel, subjectGroup, subject: event.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm">{courses.map(course => <option key={course.value} value={course.value}>{course.label}</option>)}</select></div>
    <div className={`sm:col-span-3 rounded-lg border px-3 py-2 text-xs leading-5 ${readinessClass}`}><strong>{readiness.label}</strong><span className="ml-2">{readiness.detail}</span></div>
    <p className="sm:col-span-3 text-xs leading-5 text-slate-500">선택한 학교급·교과·과목에 맞는 공식 문서만 아래에 표시됩니다. 실제 학교 편성 및 시험 범위는 학교 교육과정과 교사 자료로 확인해 주세요.</p>
  </div>;
}
