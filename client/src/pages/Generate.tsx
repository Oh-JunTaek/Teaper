import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { BookOpen, CheckCircle2, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Generate() {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ subject: "화학 I", unit: "화학 결합", difficulty: "중", questionType: "자료 분석형", points: 3, questionCount: 1, additionalRequirements: "" });
  const [prototypeReady, setPrototypeReady] = useState(false);
  const [providerId, setProviderId] = useState("managed");
  const [externalTransferConsent, setExternalTransferConsent] = useState(false);
  const officialInput = useMemo(() => ({ subject: form.subject }), [form.subject]);
  const utils = trpc.useUtils();
  const official = trpc.assessment.officialDocuments.list.useQuery(officialInput);
  const sampleQuestions = trpc.assessment.references.prototypeSamples.useQuery();
  const providers = trpc.assessment.aiProviders.list.useQuery();
  const setSampleSelection = trpc.assessment.references.setSelection.useMutation({ onSuccess: () => utils.assessment.references.prototypeSamples.invalidate() });
  const setSelection = trpc.assessment.officialDocuments.setSelection.useMutation({ onSuccess: () => utils.assessment.officialDocuments.list.invalidate() });
  const prepare = trpc.assessment.references.preparePrototype.useMutation({
    onSuccess: result => { setPrototypeReady(true); void utils.assessment.references.prototypeSamples.invalidate(); toast.success(`${result.created ? `${result.created}개` : "기존"} 프로토타입 샘플을 준비했습니다.`); },
    onError: error => toast.error(error.message),
  });
  const create = trpc.assessment.generation.create.useMutation({
    onSuccess: result => { toast.success(`${result.questionIds.length}개 문항 초안이 생성되었습니다.`); setLocation("/review"); },
    onError: error => toast.error(error.message),
  });

  const prepareSamples = () => {
    prepare.mutate();
    official.data?.forEach(row => {
      if (row.document.catalogStatus === "published" && row.document.subject === form.subject) {
        setSelection.mutate({ documentId: row.document.id, useForGeneration: true });
      }
    });
  };
  const selectedProvider = providers.data?.find(provider => String(provider.id) === providerId);
  const usesExternalProvider = selectedProvider?.providerType === "gemini" || selectedProvider?.providerType === "openai_compatible";
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (usesExternalProvider && !externalTransferConsent) { toast.error("개인 외부 AI로 전송될 자료 범위에 동의해 주세요."); return; }
    create.mutate({ ...form, providerSettingId: providerId === "managed" ? undefined : Number(providerId), confirmExternalTransfer: usesExternalProvider ? externalTransferConsent : false });
  };
  const selectedCount = official.data?.filter(row => row.useForGeneration).length ?? 0;
  const sampleRows = sampleQuestions.data?.filter(item => item.question.subject === form.subject) ?? [];
  const selectedSampleCount = sampleRows.filter(item => item.useForGeneration).length;

  return <div className="mx-auto max-w-5xl">
    <div className="text-center"><Badge className="bg-[#E6F4EE] text-[#15856B] hover:bg-[#E6F4EE]">근거 기반 문항 초안</Badge><h1 className="mt-3 text-3xl font-bold text-[#183248]">문항 생성 요청</h1><p className="mt-2 text-slate-500">등록된 교육과정·기출문제·출제 지침을 바탕으로 문항 초안을 생성합니다.</p></div>
    <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_300px]">
      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-[#183248]">출제 조건</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div><Label>과목</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="mt-1.5" /></div>
          <div><Label>단원</Label><Input required value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="예: 화학 결합" className="mt-1.5" /></div>
          <div><Label>난이도</Label><select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option>하</option><option>중</option><option>상</option></select></div>
          <div><Label>문제 유형</Label><select value={form.questionType} onChange={e => setForm({ ...form, questionType: e.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{["개념 확인형", "자료 분석형", "계산형", "그래프 해석형", "실험 자료형", "비교·추론형", "상황 적용형"].map(item => <option key={item}>{item}</option>)}</select></div>
          <div><Label>배점</Label><Input type="number" min="1" max="20" value={form.points} onChange={e => setForm({ ...form, points: Number(e.target.value) })} className="mt-1.5" /></div>
          <div><Label>문항 수 <span className="text-xs font-normal text-slate-400">(최대 5개)</span></Label><Input type="number" min="1" max="5" value={form.questionCount} onChange={e => setForm({ ...form, questionCount: Number(e.target.value) })} className="mt-1.5" /></div>
          <div className="sm:col-span-2"><Label>추가 요구사항 <span className="text-xs font-normal text-slate-400">(선택)</span></Label><Textarea value={form.additionalRequirements} onChange={e => setForm({ ...form, additionalRequirements: e.target.value })} className="mt-1.5 min-h-28" placeholder="예: 결합의 극성과 분자 모양의 관계를 판단하는 자료를 포함해 주세요." /></div>
          <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4"><Label>AI 실행 방식</Label><select value={providerId} onChange={event => { setProviderId(event.target.value); setExternalTransferConsent(false); }} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="managed">관리형 AI · 기본 제공</option>{providers.data?.map(provider => <option key={provider.id} value={String(provider.id)}>{provider.label} · {provider.model}</option>)}</select><p className="mt-2 text-xs leading-5 text-slate-500">{providerId === "managed" ? "관리형 AI가 서버에서 문항을 생성·검증합니다." : selectedProvider?.providerType === "ollama" ? "로컬 Ollama는 로컬 앱 브리지에서 문항 원문을 외부로 보내지 않고 실행합니다." : "개인 외부 AI를 선택하면 근거 텍스트와 출제 조건이 해당 제공자로 전송됩니다."}</p>{usesExternalProvider && <label className="mt-3 flex gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" checked={externalTransferConsent} onChange={event => setExternalTransferConsent(event.target.checked)} className="mt-1" /><span>이번 생성에서 문항 조건과 선택한 근거 텍스트가 <strong>{selectedProvider?.label}</strong>에 전송되는 것에 동의합니다.</span></label>}<a href="/ai-settings" className="mt-3 inline-block text-xs font-semibold text-[#116B58] underline underline-offset-4">AI 제공자 설정으로 이동</a></div>
        </div>
        <Button disabled={create.isPending} className="mt-6 h-12 w-full rounded-xl bg-[#15856B] text-base hover:bg-[#106C58]">{create.isPending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />근거 확인·초안 작성·검증 중</> : <><Sparkles className="mr-2 h-5 w-5" />문항 초안 생성</>}</Button>
      </form>
      <aside className="space-y-4">
        <div className="rounded-2xl border border-[#9CCFC0] bg-[#F2FBF6] p-5"><BookOpen className="h-5 w-5 text-[#15856B]" /><h2 className="mt-3 font-bold text-[#183248]">샘플 자료 빠른 준비</h2><p className="mt-2 text-sm leading-6 text-slate-600">화학 I 프로토타입 샘플 기출과 현재 공식 문서를 한 번에 선택합니다. 샘플 기출은 실제 국가 기출 원문이 아닌 테스트용 예시입니다.</p><Button type="button" onClick={prepareSamples} disabled={prepare.isPending} variant="outline" className="mt-4 w-full border-[#78BDAA] text-[#116B58]">{prepare.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}샘플 자료 한 번에 준비</Button><p className="mt-3 text-xs text-slate-500">현재 선택된 공식 문서 {selectedCount}개</p>{official.data && official.data.filter(row => row.useForGeneration).map(row => <p key={row.document.id} className="mt-1 text-xs text-slate-600"><strong>{row.document.title}</strong> · {row.source.provider} · {row.document.rightsStatus === "approved_for_rag" ? "본문 근거 사용" : "원문 링크·요약"}</p>)}{prototypeReady && <p className="mt-2 text-xs font-semibold text-[#15856B]">프로토타입 기출 샘플 {selectedSampleCount}개가 생성 근거로 첨부되었습니다.</p>}{sampleRows.length > 0 && <div className="mt-3 space-y-2 border-t border-[#D9EEE6] pt-3">{sampleRows.map(item => <label key={item.question.id} className="flex gap-2 text-xs text-slate-600"><input type="checkbox" checked={item.useForGeneration} onChange={event => setSampleSelection.mutate({ referenceQuestionId: item.question.id, useForGeneration: event.target.checked })} /> <span><strong>{item.question.questionText.slice(0, 54)}{item.question.questionText.length > 54 ? "…" : ""}</strong><br />{item.question.questionType} · {item.sourceLabel} · {item.useScope}</span></label>)}</div>}</div>
        <div className="rounded-2xl border border-[#B9DCCF] bg-white p-5"><CheckCircle2 className="h-5 w-5 text-[#15856B]" /><h2 className="mt-3 font-bold text-[#183248]">생성 전 확인</h2><ul className="mt-3 space-y-2 text-sm leading-5 text-slate-600"><li>교육과정·기출·지침을 함께 확인해 초안을 만듭니다.</li><li>공식 문서는 사용 범위와 출처를 기록합니다.</li><li>기출문제는 복제하지 않고 유사도 검사를 통과해야 합니다.</li></ul></div>
        <div className="rounded-2xl border border-[#F3D6A3] bg-[#FFF9EC] p-5"><TriangleAlert className="h-5 w-5 text-[#B56716]" /><h2 className="mt-3 font-bold text-[#183248]">교사 최종 검수</h2><p className="mt-2 text-sm leading-6 text-slate-600">자동 검증이 통과한 문항도 반드시 근거와 해설을 확인한 후 승인하세요.</p></div>
      </aside>
    </section>
  </div>;
}
