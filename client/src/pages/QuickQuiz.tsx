import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quickQuizPendingOverview } from "@/lib/quickQuizReview";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, FileText, Loader2, PencilLine, Printer, Sparkles, Timer, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ReviewState = "pending_review" | "approved" | "revised" | "rejected";
type QuizQuestion = { questionText: string; choices: string[]; answer: string; explanation: string; concept: string; points?: number };
type PrintableQuiz = { subject: string; unit: string; topic: string; questionFormat: keyof typeof formatLabel; questions: QuizQuestion[] };

const formatLabel = { multiple_choice: "객관식", short_answer: "주관식", ox: "O/X" } as const;
const choiceMarker = (index: number) => String.fromCharCode("①".charCodeAt(0) + index);
const reviewMeta: Record<ReviewState, { label: string; className: string }> = {
  pending_review: { label: "검수 대기", className: "bg-[#FFF2D8] text-[#B56716]" },
  approved: { label: "승인", className: "bg-[#E6F4EE] text-[#15856B]" },
  revised: { label: "수정 필요", className: "bg-[#E8EFF7] text-[#2D6496]" },
  rejected: { label: "반려", className: "bg-[#FDEBEC] text-[#B42318]" },
};

/** 이미 붙은 선택 번호를 정리해 화면·인쇄에서 번호가 한 번만 보이게 한다. */
function quizChoiceLabel(choice: string, index: number) {
  const cleaned = choice.trim().replace(/^(?:선택\s*)?(?:[①②③④]|[1-4][.)])\s*[:.)-]?\s*/, "");
  return `${choiceMarker(index)} ${cleaned || choice.trim()}`;
}

/** 숫자형 정답도 선택 값이 아니라 위치로 읽히도록 ‘①번’ 형태로 고정한다. */
function quizAnswerLabel(answer: string, choices: string[]) {
  const cleaned = answer.trim().replace(/^정답\s*[:：]?\s*/i, "").replace(/^선택\s*/i, "").replace(/번$/, "").trim();
  const markerIndex = ["①", "②", "③", "④"].indexOf(cleaned);
  const numberIndex = ["1", "2", "3", "4"].indexOf(cleaned);
  const choiceIndex = choices.indexOf(answer);
  const index = markerIndex >= 0 ? markerIndex : numberIndex >= 0 ? numberIndex : choiceIndex;
  return index >= 0 ? `${choiceMarker(index)}번` : answer.replace(/^선택\s*/i, "");
}

/** 기존 세트에 문항 상태가 없으면 모두 검수 대기로 계산해 승인 오인을 막는다. */
function reviewStatesFor(questions: QuizQuestion[], stored?: ReviewState[] | null) {
  return questions.map((_, index) => stored?.[index] ?? "pending_review");
}

/** 세트 배지는 문항별 결과의 요약이며, 학생용 출력 권한은 각 문항의 승인 상태가 기준이다. */
function reviewSummary(states: ReviewState[]) {
  const count = (state: ReviewState) => states.filter(item => item === state).length;
  if (!states.length || count("pending_review")) return { meta: reviewMeta.pending_review, text: `승인 ${count("approved")} · 검수 대기 ${count("pending_review")}` };
  if (count("approved") === states.length) return { meta: reviewMeta.approved, text: `${states.length}문항 승인` };
  if (count("rejected") === states.length) return { meta: reviewMeta.rejected, text: `${states.length}문항 반려` };
  return { meta: reviewMeta.revised, text: `승인 ${count("approved")} · 수정/반려 ${states.length - count("approved")}` };
}

/** 최신 생성 순서를 교사가 즉시 판단할 수 있도록 날짜·시각을 화면에 표시한다. */
function quizCreatedAtLabel(value: Date | string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "생성 시각 확인 필요" : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** 승인한 문항만 학생용 인쇄 창에 넣고 브라우저의 PDF 저장 기능을 사용한다. */
function printApprovedQuiz(quiz: PrintableQuiz, includePoints: boolean, watermark: boolean) {
  const safe = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const content = quiz.questions.map((question, index) => `<article><h2>${index + 1}. ${safe(question.questionText)}${includePoints && typeof question.points === "number" ? ` <span class="points">［${question.points}점］</span>` : ""}</h2>${question.choices.length ? `<ol>${question.choices.map((choice, choiceIndex) => `<li>${safe(quizChoiceLabel(choice, choiceIndex))}</li>`).join("")}</ol>` : quiz.questionFormat === "short_answer" ? "<p class=\"answer-line\">답: ________________________________________</p>" : ""}</article>`).join("");
  const popup = window.open("", "quiz-print", "width=900,height=1000");
  if (!popup) return toast.error("인쇄 창을 열 수 없습니다. 브라우저 팝업 차단을 확인해 주세요.");
  const watermarkHtml = watermark ? `<div class="student-watermark" aria-hidden="true">EunmaStudio</div>` : "";
  popup.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${safe(quiz.topic)} 쪽지시험</title><style>@page{size:A4;margin:18mm}body{font-family:'Noto Sans KR',Arial,sans-serif;color:#172033;line-height:1.65}h1{text-align:center;font-size:22px;margin:0}header{text-align:center;margin-bottom:25px}article{break-inside:avoid;padding:15px 0}.points{font-weight:400;white-space:nowrap}h2{font-size:16px;margin:8px 0}ol{padding-left:25px}.answer-line{margin-top:18px}.student-watermark{position:fixed;right:0;bottom:0;color:#94a3b8;font-size:9px;letter-spacing:.08em;opacity:.72;pointer-events:none}@media print{article{page-break-inside:avoid}}</style></head><body><header><h1>${safe(quiz.subject)} · 쪽지시험</h1></header>${content}${watermarkHtml}</body></html>`);
  popup.document.close();
  popup.focus();
  popup.print();
}

/** 일반 문항 검수함과 분리된 간결한 쪽지시험. 최신 미검수 세트를 먼저 열어 검수 누락을 줄인다. */
export default function QuickQuiz() {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ subject: "화학 I", unit: "화학 결합", topic: "", difficulty: "낮음" as "낮음" | "보통", questionFormat: "multiple_choice" as keyof typeof formatLabel, questionCount: 3 });
  const [providerId, setProviderId] = useState("managed");
  const [externalConsent, setExternalConsent] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState<number | null>(null);
  const [includePointsWhenPrinting, setIncludePointsWhenPrinting] = useState(false);
  const [pointDrafts, setPointDrafts] = useState<Record<string, string>>({});
  const providers = trpc.assessment.aiProviders.list.useQuery();
  const plan = trpc.assessment.plan.me.useQuery();
  const quizzes = trpc.assessment.quickQuiz.list.useQuery();
  const refresh = () => void utils.assessment.quickQuiz.list.invalidate();
  const create = trpc.assessment.quickQuiz.create.useMutation({ onSuccess: result => { setSelectedQuizId(result.id); toast.success(`${result.questions.length}개 쪽지시험 문항을 만들었습니다. 바로 검수해 주세요.`); refresh(); }, onError: error => toast.error(error.message) });
  const remove = trpc.assessment.quickQuiz.remove.useMutation({ onSuccess: () => { setSelectedQuizId(null); toast.success("쪽지시험을 삭제했습니다."); refresh(); }, onError: error => toast.error(error.message) });
  const reviewQuestion = trpc.assessment.quickQuiz.reviewQuestion.useMutation({ onSuccess: () => { toast.success("문항 검수 상태를 저장했습니다."); refresh(); }, onError: error => toast.error(error.message) });
  const updateQuestionPoints = trpc.assessment.quickQuiz.updateQuestionPoints.useMutation({ onSuccess: () => { toast.success("문항 배점을 저장했습니다."); refresh(); }, onError: error => toast.error(error.message) });
  const selectedProvider = providers.data?.find(provider => String(provider.id) === providerId);
  const usesExternalProvider = selectedProvider?.providerType === "gemini" || selectedProvider?.providerType === "openai_compatible" || selectedProvider?.providerType === "anthropic";
  const pendingOverview = quickQuizPendingOverview((quizzes.data ?? []).map(quiz => ({ id: quiz.id, questionCount: quiz.questionCount, questionReviewStates: quiz.questionReviewStates as ReviewState[] | null | undefined, createdAt: quiz.createdAt })));
  const selectedQuiz = quizzes.data?.find(quiz => quiz.id === selectedQuizId) ?? quizzes.data?.find(quiz => quiz.id === pendingOverview.latestPending?.id) ?? quizzes.data?.[0];
  const quizQuestions = (selectedQuiz?.questions ?? []) as QuizQuestion[];
  const reviewStates = reviewStatesFor(quizQuestions, selectedQuiz?.questionReviewStates as ReviewState[] | null | undefined);
  const summary = reviewSummary(reviewStates);
  const approvedQuestions = quizQuestions.filter((_, index) => reviewStates[index] === "approved");
  const saveQuestionPoints = (questionIndex: number, rawValue: string) => {
    if (!selectedQuiz) return;
    const points = Number(rawValue);
    if (!Number.isFinite(points) || points < 0 || points > 100 || Math.round(points * 10) !== points * 10) return toast.error("배점은 0~100점, 소수 첫째 자리까지 입력해 주세요.");
    updateQuestionPoints.mutate({ id: selectedQuiz.id, questionIndex, points });
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.topic.trim()) return toast.error("확인할 개념 또는 정의를 입력해 주세요.");
    if (usesExternalProvider && !externalConsent) return toast.error("외부 AI 전송 범위를 확인해 주세요.");
    create.mutate({ ...form, topic: form.topic.trim(), providerSettingId: providerId === "managed" ? undefined : Number(providerId), confirmExternalTransfer: usesExternalProvider ? externalConsent : false });
  };

  return <div className="mx-auto max-w-6xl">
    <div>
      <Badge className="bg-[#E8EFF7] text-[#2D6496] hover:bg-[#E8EFF7]"><Timer className="mr-1 h-3.5 w-3.5" />간결한 쪽지시험</Badge>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#183248]">쪽지시험 만들기</h1>
      <p className="mt-2 text-slate-500">한두 문장으로 끝나는 짧은 개념 확인 문항을 만들고, 문항마다 정답과 해설을 교사가 확인한 뒤 사용합니다.</p>
    </div>
    <section className="mt-7 grid gap-5 lg:grid-cols-[410px_1fr]">
      <form onSubmit={submit} className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-[#183248]">쪽지시험 조건</h2>
        <div className="mt-5 grid gap-4">
          <div><Label>과목</Label><Input value={form.subject} onChange={event => setForm(current => ({ ...current, subject: event.target.value }))} className="mt-1.5" /></div>
          <div><Label>단원</Label><Input value={form.unit} onChange={event => setForm(current => ({ ...current, unit: event.target.value }))} className="mt-1.5" /></div>
          <div><Label>확인할 개념·정의</Label><Input value={form.topic} onChange={event => setForm(current => ({ ...current, topic: event.target.value }))} placeholder="예: 공유 결합의 정의" className="mt-1.5" /></div>
          <div><Label>문항 형식</Label><select value={form.questionFormat} onChange={event => setForm(current => ({ ...current, questionFormat: event.target.value as keyof typeof formatLabel }))} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="multiple_choice">객관식</option><option value="short_answer">주관식</option><option value="ox">O/X</option></select></div>
          <div className="grid grid-cols-2 gap-3"><div><Label>난이도</Label><select value={form.difficulty} onChange={event => setForm(current => ({ ...current, difficulty: event.target.value as "낮음" | "보통" }))} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option>낮음</option><option>보통</option></select></div><div><Label>문항 수</Label><Input type="number" min="1" max="10" value={form.questionCount} onChange={event => setForm(current => ({ ...current, questionCount: Number(event.target.value) }))} className="mt-1.5" /></div></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><Label>AI 실행 방식</Label><select value={providerId} onChange={event => { setProviderId(event.target.value); setExternalConsent(false); }} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="managed">관리형 AI · 기본 제공</option>{providers.data?.map(provider => <option key={provider.id} value={String(provider.id)}>{provider.label} · {provider.model}</option>)}</select>{usesExternalProvider ? <label className="mt-3 flex gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" checked={externalConsent} onChange={event => setExternalConsent(event.target.checked)} /><span>이번 요청의 과목·단원·개념·형식과 생성 문항이 개인 외부 AI로 전송됨을 확인합니다.</span></label> : null}</div>
        </div>
        <Button type="submit" disabled={create.isPending} className="mt-5 h-11 w-full bg-[#15856B] hover:bg-[#106C58]">{create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}{create.isPending ? "쪽지시험 생성 중" : "쪽지시험 생성"}</Button>
      </form>
      <div>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="font-bold text-[#183248]">쪽지시험 검수</h2><p className="mt-1 text-sm text-slate-500">문항마다 승인·수정 필요·반려를 선택합니다. 학생용 출력에는 승인 문항만 들어갑니다.</p></div>{selectedQuiz ? <Button size="sm" variant="outline" className="w-fit text-red-600 hover:text-red-700" onClick={() => { if (window.confirm("이 쪽지시험 세트를 삭제할까요?")) remove.mutate({ id: selectedQuiz.id }); }}><Trash2 className="mr-1.5 h-3.5 w-3.5" />현재 세트 삭제</Button> : null}</div>
        {quizzes.data?.length ? <section className={`mt-4 rounded-2xl border p-4 ${pendingOverview.pendingQuestionCount ? "border-[#E9C779] bg-[#FFFBF1]" : "border-[#B9DCCF] bg-[#F4FBF7]"}`}><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-3"><AlertCircle className={`mt-0.5 h-5 w-5 ${pendingOverview.pendingQuestionCount ? "text-[#B56716]" : "text-[#15856B]"}`} /><div><p className="font-semibold text-[#183248]">{pendingOverview.pendingQuestionCount ? `검수 대기 ${pendingOverview.pendingSetCount}세트 · ${pendingOverview.pendingQuestionCount}문항` : "모든 쪽지시험 문항을 처리했습니다."}</p><p className="mt-1 text-xs text-slate-600">{pendingOverview.latestPending ? `가장 최근 미검수 세트: ${quizCreatedAtLabel(pendingOverview.latestPending.createdAt)}` : "새 문항을 만들면 이곳에 검수 대기 현황이 표시됩니다."}</p></div></div>{pendingOverview.latestPending ? <Button size="sm" variant="outline" onClick={() => setSelectedQuizId(pendingOverview.latestPending!.id)}>최근 미검수 세트 열기</Button> : null}</div></section> : null}
        {quizzes.data && quizzes.data.length > 1 ? <label className="mt-4 block text-sm font-medium text-[#183248]">검수할 세트<select value={String(selectedQuiz?.id ?? "")} onChange={event => setSelectedQuizId(Number(event.target.value))} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm">{quizzes.data.map(quiz => <option key={quiz.id} value={quiz.id}>{quizCreatedAtLabel(quiz.createdAt)} · {quiz.subject} · {quiz.topic}</option>)}</select></label> : null}
        {quizzes.isLoading ? <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />생성 결과를 불러오는 중입니다.</div> : selectedQuiz ? <div className="mt-4 space-y-4"><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div><p className="font-semibold text-[#183248]">{selectedQuiz.subject} · {selectedQuiz.unit}</p><p className="mt-1 text-sm text-slate-500">{selectedQuiz.topic} · {formatLabel[selectedQuiz.questionFormat as keyof typeof formatLabel] ?? "객관식"} · {summary.text}</p><p className="mt-1 text-xs text-slate-400">생성: {quizCreatedAtLabel(selectedQuiz.createdAt)}</p></div><Badge className={summary.meta.className}>{summary.meta.label}</Badge></div>{approvedQuestions.length ? <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={includePointsWhenPrinting} onChange={event => setIncludePointsWhenPrinting(event.target.checked)} />배점 표기</label><span className="text-xs text-slate-500">{plan.data?.canRemoveStudentWatermark ? "교사 플러스: EunmaStudio 표기 없음" : "교사 기본: 오른쪽 아래 EunmaStudio 표기"}</span><Button size="sm" variant="outline" onClick={() => printApprovedQuiz({ subject: selectedQuiz.subject, unit: selectedQuiz.unit, topic: selectedQuiz.topic, questionFormat: (selectedQuiz.questionFormat as keyof typeof formatLabel) ?? "multiple_choice", questions: approvedQuestions }, includePointsWhenPrinting, !plan.data?.canRemoveStudentWatermark)}><Printer className="mr-1.5 h-4 w-4" />승인 문항 학생용 인쇄·PDF ({approvedQuestions.length})</Button></div> : null}{quizQuestions.map((question, index) => { const state = reviewStates[index]; const pointKey = `${selectedQuiz.id}-${index}`; const pointValue = pointDrafts[pointKey] ?? (typeof question.points === "number" ? String(question.points) : ""); return <article key={pointKey} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Badge variant="secondary">{index + 1}번</Badge><Badge className="bg-[#F2FBF6] text-[#15856B] hover:bg-[#F2FBF6]">{question.concept}</Badge></div><Badge className={reviewMeta[state].className}>{reviewMeta[state].label}</Badge></div><p className="mt-4 font-semibold leading-7 text-[#183248]">{question.questionText}</p>{question.choices.length ? <ol className="mt-3 space-y-1 text-sm text-slate-600">{question.choices.map((choice, choiceIndex) => <li key={choiceIndex}>{quizChoiceLabel(choice, choiceIndex)}</li>)}</ol> : selectedQuiz.questionFormat === "short_answer" ? <p className="mt-3 text-sm text-slate-500">학생이 짧게 답을 작성하는 주관식 문항입니다.</p> : null}<div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex flex-wrap items-center gap-2"><Label htmlFor={`quick-points-${pointKey}`} className="text-sm">배점</Label><Input id={`quick-points-${pointKey}`} inputMode="decimal" type="number" min="0" max="100" step="0.1" value={pointValue} onChange={event => setPointDrafts(current => ({ ...current, [pointKey]: event.target.value }))} onBlur={() => { if (pointValue !== "") saveQuestionPoints(index, pointValue); }} className="h-9 w-24 bg-white" placeholder="0~100" /><span className="text-sm text-slate-500">점</span>{[2, 3, 4].map(points => <Button key={points} type="button" size="sm" variant="outline" disabled={updateQuestionPoints.isPending} onClick={() => { setPointDrafts(current => ({ ...current, [pointKey]: String(points) })); saveQuestionPoints(index, String(points)); }}>{points}점</Button>)}</div></div><div className="mt-4 rounded-xl bg-[#F7FCF9] p-3 text-sm leading-6 text-slate-700"><p><strong className="text-[#183248]">정답:</strong> {quizAnswerLabel(question.answer, question.choices)}</p><p className="mt-1"><strong className="text-[#183248]">해설:</strong> {question.explanation}</p></div><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" disabled={reviewQuestion.isPending || state === "approved"} onClick={() => reviewQuestion.mutate({ id: selectedQuiz.id, questionIndex: index, status: "approved" })}><CheckCircle2 className="mr-1.5 h-4 w-4" />이 문항 승인</Button><Button size="sm" variant="outline" disabled={reviewQuestion.isPending || state === "revised"} onClick={() => reviewQuestion.mutate({ id: selectedQuiz.id, questionIndex: index, status: "revised" })}><PencilLine className="mr-1.5 h-4 w-4" />수정 필요</Button><Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" disabled={reviewQuestion.isPending || state === "rejected"} onClick={() => reviewQuestion.mutate({ id: selectedQuiz.id, questionIndex: index, status: "rejected" })}><XCircle className="mr-1.5 h-4 w-4" />이 문항 반려</Button></div></article>; })}</div> : <div className="mt-4 rounded-2xl border border-dashed border-[#B9DCCF] bg-[#F7FCF9] p-8 text-center"><FileText className="mx-auto h-7 w-7 text-[#15856B]" /><h2 className="mt-3 font-semibold text-[#183248]">아직 만든 쪽지시험이 없습니다.</h2><p className="mt-2 text-sm leading-6 text-slate-500">확인할 개념을 입력하면 현재 사용자 계정에만 저장되는 짧은 문제 세트가 준비됩니다.</p></div>}
      </div>
    </section>
  </div>;
}
