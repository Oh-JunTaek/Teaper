import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { BarChart3, BookOpenCheck, FileArchive, NotebookPen, Sparkles, Timer } from "lucide-react";
import { useLocation } from "wouter";

const statCards = [
  { key: "materialCount", label: "등록 자료", icon: FileArchive, tone: "bg-[#E6F4EE] text-[#15856B]" },
  { key: "questionCount", label: "생성 문항", icon: Sparkles, tone: "bg-[#F2EAFE] text-[#7B56B3]" },
  { key: "approvedCount", label: "승인 문항", icon: BookOpenCheck, tone: "bg-[#FFF2D8] text-[#B56716]" },
  { key: "noteCount", label: "메모", icon: NotebookPen, tone: "bg-[#E8EFF7] text-[#2D6496]" },
  { key: "quickQuizCount", label: "쪽지시험", icon: Timer, tone: "bg-[#EAF4FF] text-[#2773A7]" },
] as const;

/** 계정 정보는 최소한으로 보여 주고, 자료·문항 원문 대신 작업 수만 피드백한다. */
export default function Profile() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const stats = trpc.assessment.dashboard.useQuery();
  const plan = trpc.assessment.plan.me.useQuery();
  return <div className="mx-auto max-w-5xl">
    <Badge className="bg-[#E8EFF7] text-[#2D6496] hover:bg-[#E8EFF7]">내 작업공간</Badge>
    <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><h1 className="text-3xl font-bold tracking-tight text-[#183248]">내 정보와 작업 현황</h1><p className="mt-2 text-slate-600">{user?.name || "교사"}님이 이 계정에서 준비하고 검수한 작업의 수를 확인합니다.</p></div><Button onClick={() => setLocation("/generate")} className="bg-[#15856B] hover:bg-[#106C58]"><Sparkles className="mr-2 h-4 w-4" />문항 생성</Button></div>
    <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{statCards.map(card => <article key={card.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`grid h-9 w-9 place-items-center rounded-xl ${card.tone}`}><card.icon className="h-4 w-4" /></div><p className="mt-5 text-2xl font-bold tabular-nums text-[#183248]">{stats.isLoading ? "–" : stats.data?.[card.key] ?? 0}</p><p className="mt-1 text-xs font-medium text-slate-500">{card.label}</p></article>)}</section>
    <section className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]"><article className="rounded-2xl border border-[#B9DCCF] bg-[#F2FBF6] p-6 shadow-sm"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#15856B]"><BarChart3 className="h-5 w-5" /></span><div><h2 className="font-bold text-[#183248]">작업 피드백</h2><p className="mt-2 text-sm leading-6 text-slate-600">생성 문항은 검수함에서 근거·정답·해설을 확인한 뒤 승인하세요. 자료·문항·메모·쪽지시험 수는 이 계정의 작업 현황을 보여 주기 위한 값이며, 원문 내용은 통계에 포함하지 않습니다.</p><p className="mt-3 text-xs leading-5 text-[#477164]">운영용 집계는 개인정보·자료명·문항 원문·대화 내용을 제외한 최소 사용량만 별도로 다룹니다.</p></div></div></article><article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="font-bold text-[#183248]">현재 플랜</h2><Badge className={plan.data?.plan === "plus" ? "bg-[#FFF2D8] text-[#A66C08] hover:bg-[#FFF2D8]" : "bg-[#E6F4EE] text-[#15856B] hover:bg-[#E6F4EE]"}>{plan.data?.label || "확인 중"}</Badge></div><p className="mt-3 text-sm leading-6 text-slate-600">교사 기본은 자료 관리·검수·기본 출력·개인 API·로컬 모델 선택권을 유지합니다. 교사 플러스 파일럿은 문제집형 PDF와 더 넓은 관리형 AI 포함 작업을 제공합니다.</p><p className="mt-3 text-xs leading-5 text-[#8C5A14]">파일럿 기준 안내이며 결제·자동 플랜 변경은 연결되어 있지 않습니다.</p><Button variant="outline" onClick={() => setLocation("/approved")} className="mt-4 border-[#D9B46B] bg-[#FFF9EC] text-[#8C5A14] hover:bg-[#FFF2D8]">플랜 혜택 확인</Button></article></section>
  </div>;
}
