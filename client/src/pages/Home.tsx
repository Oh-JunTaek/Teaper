import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CurriculumScopeSelect } from "@/components/CurriculumScopeSelect";
import { trpc } from "@/lib/trpc";
import type { CourseReadiness, SchoolLevel, SubjectGroup } from "@shared/curriculumScope";
import { ArrowRight, BookOpen, ClipboardCheck, FileText, LoaderCircle, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

const cards = [
  { key: "materialCount", label: "등록 참고 자료", detail: "교육과정·지침·교수 자료", icon: FileText, tone: "bg-[#E6F4EE] text-[#15856B]", path: "/materials" },
  { key: "referenceCount", label: "구조화된 기출문제", detail: "유형·난이도·출제 의도", icon: BookOpen, tone: "bg-[#E8EFF7] text-[#2D6496]", path: "/references" },
  { key: "reviewCount", label: "검수 대기 문항", detail: "근거 및 검증 결과 확인", icon: ClipboardCheck, tone: "bg-[#FFF2D8] text-[#B56716]", path: "/review" },
  { key: "approvedCount", label: "승인된 문항", detail: "CSV로 내보낼 수 있는 문항", icon: Sparkles, tone: "bg-[#F2EAFE] text-[#7B56B3]", path: "/approved" },
] as const;

export default function Home() {
  const { data, isLoading } = trpc.assessment.dashboard.useQuery();
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>("high");
  const [subjectGroup, setSubjectGroup] = useState<SubjectGroup>("science");
  const [subject, setSubject] = useState("화학 I");
  const [readinessFilter, setReadinessFilter] = useState<"all" | CourseReadiness["status"]>("all");
  const officialDocumentInput = useMemo(() => ({ subject }), [subject]);
  const { data: officialDocuments } = trpc.assessment.officialDocuments.list.useQuery(officialDocumentInput);
  const [, setLocation] = useLocation();
  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div><Badge className="rounded-md bg-[#E6F4EE] px-2.5 py-1 text-[#15856B] hover:bg-[#E6F4EE]">문제 출제 워크스페이스</Badge><h1 className="mt-3 text-3xl font-bold tracking-tight text-[#183248]">오늘의 출제 업무</h1><p className="mt-2 text-slate-500">준비한 자료를 바탕으로 문항을 생성하고, 검수 이력을 남겨 관리합니다.</p></div>
        <Button onClick={() => setLocation("/generate")} className="h-11 rounded-xl bg-[#15856B] px-5 hover:bg-[#106C58]"><Sparkles className="mr-2 h-4 w-4" />문항 생성 시작</Button>
      </div>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => <button key={card.key} onClick={() => setLocation(card.path)} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#9CCFC0] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15856B]"><div className="flex items-start justify-between"><div className={`grid h-10 w-10 place-items-center rounded-xl ${card.tone}`}><card.icon className="h-5 w-5" /></div><span aria-live="polite" className="flex min-h-8 min-w-14 items-center justify-end text-3xl font-bold tracking-tight text-[#183248]">{isLoading ? <span className="flex items-center gap-2 text-xs font-medium text-slate-400"><LoaderCircle className="h-5 w-5 animate-spin text-[#15856B]" /><span>조회 중</span></span> : data?.[card.key] ?? 0}</span></div><h2 className="mt-5 font-semibold text-[#183248]">{card.label}</h2><p className="mt-1 text-xs text-slate-500">{card.detail}</p><p className="mt-3 text-xs font-semibold text-[#15856B]">{isLoading ? "통계를 불러오는 중" : "열기 →"}</p></button>)}
      </section>
      <section className="mt-7 rounded-2xl border border-[#B9DCCF] bg-[#F2FBF6] p-5"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-semibold text-[#15856B]">기본 공식 문서</p><p className="mt-1 text-sm text-slate-600">학교급과 과목을 고르면 해당 교육과정 문서만 간결하게 확인할 수 있습니다.</p></div><Button variant="outline" onClick={() => setLocation("/materials")} className="w-fit border-[#B9DCCF] bg-white text-[#15856B] hover:bg-white">문서 확인하기<ArrowRight className="ml-2 h-4 w-4" /></Button></div><div className="mt-4"><CurriculumScopeSelect schoolLevel={schoolLevel} subjectGroup={subjectGroup} subject={subject} readinessFilter={readinessFilter} onReadinessFilterChange={setReadinessFilter} onChange={next => { setSchoolLevel(next.schoolLevel); setSubjectGroup(next.subjectGroup); setSubject(next.subject); }} /></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{officialDocuments?.map(({ document }) => <div key={document.id} className="rounded-xl border border-white bg-white/85 p-3"><p className="text-xs font-semibold text-[#183248]">{document.title}</p><p className="mt-1 text-[11px] text-slate-500">{document.applicableYear}</p></div>)}{officialDocuments?.length === 0 && <p className="rounded-xl border border-dashed border-[#B9DCCF] bg-white/70 p-3 text-sm text-slate-500 md:col-span-2 xl:col-span-4">이 과목의 공식 문서는 준비 중입니다. 자료 화면에서 학교 자료를 추가하거나, 공식 출처 링크를 확인해 주세요.</p>}</div></section>
      <section className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl bg-[#173B53] p-7 text-white shadow-[0_16px_36px_rgba(23,59,83,0.16)]"><p className="text-sm font-semibold text-[#8CD5B6]">권장 작업 흐름</p><h2 className="mt-2 text-2xl font-bold">자료를 준비한 뒤, 문항을 생성하세요.</h2><p className="mt-3 max-w-xl leading-7 text-slate-300">교육과정·출제 지침·기출문제를 등록하면 검색 결과가 문항 생성과 검수 근거에 함께 연결됩니다.</p><div className="mt-6 flex flex-wrap gap-2">{["1. 참고 자료", "2. 기출문제", "3. 문항 생성", "4. 검수·승인"].map(item => <span key={item} className="rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-xs text-slate-200">{item}</span>)}</div><Button variant="secondary" onClick={() => setLocation("/materials")} className="mt-7 rounded-xl bg-white text-[#173B53] hover:bg-slate-100">자료 등록하기<ArrowRight className="ml-2 h-4 w-4" /></Button></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-7"><p className="text-sm font-semibold text-[#15856B]">검수 원칙</p><h2 className="mt-2 text-xl font-bold text-[#183248]">AI 초안은 교사가 최종 판단합니다.</h2><div className="mt-5 space-y-4 text-sm leading-6 text-slate-600"><p><strong className="text-[#183248]">근거 추적</strong><br />사용된 교육자료·기출문제·지침을 문항과 연결해 확인합니다.</p><p><strong className="text-[#183248]">자동 검증</strong><br />범위, 정답·해설, 난이도, 유사도를 확인하고 실패 결과는 보류합니다.</p><p><strong className="text-[#183248]">검수 기록</strong><br />승인·수정·반려 사유를 남겨 다음 출제 품질을 개선합니다.</p></div></article>
      </section>
    </div>
  );
}
