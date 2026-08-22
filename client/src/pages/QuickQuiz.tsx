import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, FileText, Loader2, PencilLine, Sparkles, Timer, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type QuizQuestion = { questionText: string; choices: string[]; answer: string; explanation: string; concept: string };
const reviewMeta = {
  pending_review: { label: "검수 대기", className: "bg-[#FFF2D8] text-[#B56716]" },
  approved: { label: "승인", className: "bg-[#E6F4EE] text-[#15856B]" },
  revised: { label: "수정 필요", className: "bg-[#E8EFF7] text-[#2D6496]" },
  rejected: { label: "반려", className: "bg-[#FDEBEC] text-[#B42318]" },
} as const;

/** 간결한 쪽지시험은 일반 문항 검수함과 섞지 않고, 세트 단위로 검수 상태를 남긴다. */
export default function QuickQuiz() {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ subject: "화학 I", unit: "화학 결합", topic: "", difficulty: "낮음" as "낮음" | "보통", questionCount: 3 });
  const [providerId, setProviderId] = useState("managed");
  const [externalConsent, setExternalConsent] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState<number | null>(null);
  const providers = trpc.assessment.aiProviders.list.useQuery();
  const quizzes = trpc.assessment.quickQuiz.list.useQuery();
  const create = trpc.assessment.quickQuiz.create.useMutation({
    onSuccess: result => { setSelectedQuizId(result.id); toast.success(`${result.questions.length}개 쪽지시험 문항을 만들었습니다.`); void utils.assessment.quickQuiz.list.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.assessment.quickQuiz.remove.useMutation({
    onSuccess: () => { setSelectedQuizId(null); toast.success("쪽지시험을 삭제했습니다."); void utils.assessment.quickQuiz.list.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const review = trpc.assessment.quickQuiz.review.useMutation({
    onSuccess: () => { toast.success("쪽지시험 검수 상태를 저장했습니다."); void utils.assessment.quickQuiz.list.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const selectedProvider = providers.data?.find(provider => String(provider.id) === providerId);
  const usesExternalProvider = selectedProvider?.providerType === "gemini" || selectedProvider?.providerType === "openai_compatible" || selectedProvider?.providerType === "anthropic";
  const selectedQuiz = quizzes.data?.find(quiz => quiz.id === selectedQuizId) ?? quizzes.data?.[0];
  const quizQuestions = (selectedQuiz?.questions ?? []) as QuizQuestion[];
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.topic.trim()) return toast.error("확인할 개념 또는 정의를 입력해 주세요.");
    if (usesExternalProvider && !externalConsent) return toast.error("외부 AI 전송 범위를 확인해 주세요.");
    create.mutate({ ...form, topic: form.topic.trim(), providerSettingId: providerId === "managed" ? undefined : Number(providerId), confirmExternalTransfer: usesExternalProvider ? externalConsent : false });
  };
  return <div className="mx-auto max-w-6xl">
    <div><Badge className="bg-[#E8EFF7] text-[#2D6496] hover:bg-[#E8EFF7]"><Timer className="mr-1 h-3.5 w-3.5" />간결한 쪽지시험</Badge><h1 className="mt-3 text-3xl font-bold tracking-tight text-[#183248]">쪽지시험 만들기</h1><p className="mt-2 text-slate-500">한두 문장으로 끝나는 짧은 개념 확인 문항을 만들고, 정답과 해설을 교사가 확인한 뒤 사용합니다.</p></div>
    <section className="mt-7 grid gap-5 lg:grid-cols-[410px_1fr]">
      <form onSubmit={submit} className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-[#183248]">쪽지시험 조건</h2><div className="mt-5 grid gap-4"><div><Label>과목</Label><Input value={form.subject} onChange={event => setForm(current => ({ ...current, subject: event.target.value }))} className="mt-1.5" /></div><div><Label>단원</Label><Input value={form.unit} onChange={event => setForm(current => ({ ...current, unit: event.target.value }))} placeholder="예: 화학 결합" className="mt-1.5" /></div><div><Label>확인할 개념·정의</Label><Input value={form.topic} onChange={event => setForm(current => ({ ...current, topic: event.target.value }))} placeholder="예: 공유 결합의 정의" className="mt-1.5" /></div><div className="grid grid-cols-2 gap-3"><div><Label>난이도</Label><select value={form.difficulty} onChange={event => setForm(current => ({ ...current, difficulty: event.target.value as "낮음" | "보통" }))} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option>낮음</option><option>보통</option></select></div><div><Label>문항 수</Label><Input type="number" min="1" max="10" value={form.questionCount} onChange={event => setForm(current => ({ ...current, questionCount: Number(event.target.value) }))} className="mt-1.5" /></div></div><div className="rounded-xl border border-[#B9DCCF] bg-[#F7FCF9] p-3 text-xs leading-5 text-slate-600"><strong className="text-[#183248]">생성 기준</strong><br />한 문항에 한 개념만 확인합니다. 복합 자료, 긴 배경 설명, 여러 단계 추론은 쪽지시험에 포함하지 않습니다.</div><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><Label>AI 실행 방식</Label><select value={providerId} onChange={event => { setProviderId(event.target.value); setExternalConsent(false); }} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="managed">관리형 AI · 기본 제공</option>{providers.data?.map(provider => <option key={provider.id} value={String(provider.id)}>{provider.label} · {provider.model}</option>)}</select>{usesExternalProvider ? <label className="mt-3 flex gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" checked={externalConsent} onChange={event => setExternalConsent(event.target.checked)} /><span>과목·단원·개념·난이도와 생성된 문항이 개인 외부 AI에 전송되는 것을 이번 요청에 한해 확인합니다.</span></label> : <p className="mt-2 text-xs leading-5 text-slate-500">관리형 AI는 쪽지시험 문항을 생성합니다.</p>}</div></div><Button type="submit" disabled={create.isPending} className="mt-5 h-11 w-full bg-[#15856B] hover:bg-[#106C58]">{create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}{create.isPending ? "쪽지시험 생성 중" : "쪽지시험 생성"}</Button>{create.isPending ? <p className="mt-3 text-center text-xs text-slate-500" aria-live="polite">단일 개념을 확인하고 간결한 문항을 만들고 있습니다.</p> : null}</form>
      <div><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="font-bold text-[#183248]">쪽지시험 검수</h2><p className="mt-1 text-sm text-slate-500">세트 전체의 정답·해설을 확인한 뒤 승인·수정 필요·반려 상태를 기록합니다. 일반 문항 검수함과는 별도입니다.</p></div>{selectedQuiz ? <Button size="sm" variant="outline" className="w-fit text-red-600 hover:text-red-700" onClick={() => { if (window.confirm("이 쪽지시험 세트를 삭제할까요?")) remove.mutate({ id: selectedQuiz.id }); }}><Trash2 className="mr-1.5 h-3.5 w-3.5" />현재 세트 삭제</Button> : null}</div>{quizzes.data && quizzes.data.length > 1 ? <label className="mt-4 block text-sm font-medium text-[#183248]">검수할 세트<select value={String(selectedQuiz?.id ?? "")} onChange={event => setSelectedQuizId(Number(event.target.value))} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm">{quizzes.data.map(quiz => <option key={quiz.id} value={quiz.id}>{quiz.subject} · {quiz.unit} · {quiz.topic}</option>)}</select></label> : null}{quizzes.isLoading ? <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />생성 결과를 불러오는 중입니다.</div> : selectedQuiz ? <div className="mt-4 space-y-4"><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div><p className="font-semibold text-[#183248]">{selectedQuiz.subject} · {selectedQuiz.unit}</p><p className="mt-1 text-sm text-slate-500">{selectedQuiz.topic} · {selectedQuiz.questionCount}문항</p></div><Badge className={reviewMeta[selectedQuiz.status].className}>{reviewMeta[selectedQuiz.status].label}</Badge></div><div className="flex flex-wrap gap-2"><Button size="sm" disabled={review.isPending || selectedQuiz.status === "approved"} onClick={() => review.mutate({ id: selectedQuiz.id, status: "approved" })}><CheckCircle2 className="mr-1.5 h-4 w-4" />승인</Button><Button size="sm" variant="outline" disabled={review.isPending || selectedQuiz.status === "revised"} onClick={() => review.mutate({ id: selectedQuiz.id, status: "revised" })}><PencilLine className="mr-1.5 h-4 w-4" />수정 필요</Button><Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" disabled={review.isPending || selectedQuiz.status === "rejected"} onClick={() => review.mutate({ id: selectedQuiz.id, status: "rejected" })}><XCircle className="mr-1.5 h-4 w-4" />반려</Button></div>{quizQuestions.map((question, index) => <article key={`${selectedQuiz.id}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{index + 1}번</Badge><Badge className="bg-[#F2FBF6] text-[#15856B] hover:bg-[#F2FBF6]">{question.concept}</Badge></div><p className="mt-4 font-semibold leading-7 text-[#183248]">{question.questionText}</p>{question.choices.length ? <ol className="mt-3 space-y-1 text-sm text-slate-600">{question.choices.map((choice, choiceIndex) => <li key={choiceIndex}>{String.fromCharCode("①".charCodeAt(0) + choiceIndex)} {choice}</li>)}</ol> : null}<div className="mt-4 rounded-xl bg-[#F7FCF9] p-3 text-sm leading-6 text-slate-700"><p><strong className="text-[#183248]">정답:</strong> {question.answer}</p><p className="mt-1"><strong className="text-[#183248]">해설:</strong> {question.explanation}</p></div></article>)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-[#B9DCCF] bg-[#F7FCF9] p-8 text-center"><FileText className="mx-auto h-7 w-7 text-[#15856B]" /><h2 className="mt-3 font-semibold text-[#183248]">아직 만든 쪽지시험이 없습니다.</h2><p className="mt-2 text-sm leading-6 text-slate-500">확인할 개념을 입력하면 현재 사용자 계정에만 저장되는 짧은 문제 세트가 준비됩니다.</p></div>}</div>
    </section>
  </div>;
}
