import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { PERSONAL_PROVIDER_CATALOG, type PersonalProviderType } from "@shared/aiProviderCatalog";
import { CheckCircle2, Cloud, ExternalLink, HelpCircle, KeyRound, Laptop, Loader2, ShieldCheck, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

type ProviderType = "ollama" | PersonalProviderType;

const defaults: Record<ProviderType, { label: string; baseUrl: string; model: string }> = {
  ollama: { label: "내 PC의 Ollama", baseUrl: "http://127.0.0.1:11434", model: "qwen3:8b" },
  openai_compatible: { label: PERSONAL_PROVIDER_CATALOG.openai.label, baseUrl: "https://api.openai.com/v1", model: PERSONAL_PROVIDER_CATALOG.openai.defaultModel },
  gemini: { label: PERSONAL_PROVIDER_CATALOG.gemini.label, baseUrl: "", model: PERSONAL_PROVIDER_CATALOG.gemini.defaultModel },
  anthropic: { label: PERSONAL_PROVIDER_CATALOG.anthropic.label, baseUrl: "", model: PERSONAL_PROVIDER_CATALOG.anthropic.defaultModel },
};

const localRecommendations = [
  { model: "gemma3n:e2b", tier: "초경량", requirement: "메모리 8GB 이상", use: "저사양 PC·모바일 확장 연구 후보" },
  { model: "gemma3n:e4b", tier: "경량", requirement: "메모리 12GB 이상", use: "저사양 PC의 Gemma 대안" },
  { model: "qwen3:8b", tier: "표준", requirement: "메모리 16GB 또는 VRAM 6GB 이상", use: "일반 화학 I 출제 보조" },
  { model: "qwen3:14b", tier: "권장", requirement: "메모리 32GB 또는 VRAM 10GB 이상", use: "복잡한 자료와 해설 품질 우선" },
];
const LOCAL_TEST_INSTALLER_URL = "/manus-storage/teacher-assessment-local-test-0.1.0-beta.1-setup_dc17b7fd.exe";

function HelpTip({ children }: { children: React.ReactNode }) {
  return <Tooltip><TooltipTrigger asChild><button type="button" aria-label="도움말" className="ml-1 inline-flex align-middle text-slate-400 hover:text-[#15856B]"><HelpCircle className="h-3.5 w-3.5" /></button></TooltipTrigger><TooltipContent className="max-w-64 leading-5">{children}</TooltipContent></Tooltip>;
}

export default function AiSettings() {
  const utils = trpc.useUtils();
  const providers = trpc.assessment.aiProviders.list.useQuery();
  const preferences = trpc.assessment.aiProviders.preferences.useQuery();
  const [type, setType] = useState<ProviderType>("ollama");
  const [label, setLabel] = useState(defaults.ollama.label);
  const [baseUrl, setBaseUrl] = useState(defaults.ollama.baseUrl);
  const [model, setModel] = useState(defaults.ollama.model);
  const [apiKey, setApiKey] = useState("");
  const [consent, setConsent] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const external = type !== "ollama";
  const selectedCatalog = type === "gemini" ? PERSONAL_PROVIDER_CATALOG.gemini : type === "openai_compatible" ? PERSONAL_PROVIDER_CATALOG.openai : type === "anthropic" ? PERSONAL_PROVIDER_CATALOG.anthropic : null;

  useEffect(() => { if (preferences.data) setCustomInstructions(preferences.data.customInstructions); }, [preferences.data]);

  const create = trpc.assessment.aiProviders.create.useMutation({
    onSuccess: () => { toast.success("AI 제공자 설정을 저장했습니다."); setApiKey(""); void utils.assessment.aiProviders.list.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const verify = trpc.assessment.aiProviders.verify.useMutation({
    onSuccess: result => { toast.success(`${result.message}${result.models.length ? ` · ${result.models.slice(0, 3).join(", ")}` : ""}`); void utils.assessment.aiProviders.list.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const savePreferences = trpc.assessment.aiProviders.savePreferences.useMutation({
    onSuccess: () => { toast.success("문항 작성 선호를 저장했습니다."); void utils.assessment.aiProviders.preferences.invalidate(); },
    onError: error => toast.error(error.message),
  });

  const changeType = (next: ProviderType) => {
    setType(next); setLabel(defaults[next].label); setBaseUrl(defaults[next].baseUrl); setModel(defaults[next].model); setApiKey(""); setConsent(false);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({ providerType: type, label, baseUrl: baseUrl || undefined, model, apiKey: external ? apiKey : undefined, confirmExternalTransfer: external ? consent : false });
  };

  return <div className="mx-auto max-w-6xl">
    <Badge className="bg-[#E6F4EE] text-[#15856B] hover:bg-[#E6F4EE]">AI 실행 환경</Badge>
    <h1 className="mt-3 text-3xl font-bold text-[#183248]">AI 제공자 설정</h1>
    <p className="mt-2 max-w-3xl leading-6 text-slate-600">관리형 AI를 바로 사용하거나, 자료를 PC 밖으로 보내지 않는 로컬 Ollama·개인 API를 선택할 수 있습니다. 어떤 방식이든 문항 생성·근거 확인·검수 화면은 동일하게 유지됩니다.</p>

    <section className="mt-6 rounded-2xl border border-[#B9DCCF] bg-[#F2FBF6] p-5 shadow-sm"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#2773A7]"><Cloud className="h-5 w-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-[#183248]">개발용 기본값 · 관리형 AI</h2><Badge className="bg-white text-[#15856B] hover:bg-white">바로 사용 가능</Badge></div><p className="mt-1 text-sm leading-6 text-slate-600">개인 API 키를 등록하지 않아도 문항 생성 화면의 <strong>AI 실행 방식</strong>에서 기본으로 선택됩니다. 개발·파일럿 중에는 이 기본값을 그대로 사용할 수 있으며, 개인 Gemini·OpenAI·Claude·로컬 모델은 필요할 때만 아래에서 추가하세요.</p><p className="mt-2 text-xs leading-5 text-[#477164]">관리형 AI는 등록된 개인 제공자 목록에 나타나지 않는 서버 기본 실행 방식입니다.</p></div></div></section>

    <section className="mt-7 rounded-2xl border border-[#B9DCCF] bg-[#F2FBF6] p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#15856B]"><Laptop className="h-5 w-5" /></span><div><h2 className="font-bold text-[#183248]">로컬 AI를 처음 준비하시나요?</h2><p className="mt-1 text-sm leading-6 text-slate-600">비개발자 교사는 CMD 입력보다 Ollama 설치 파일 방식을 권장합니다. 설치 후 로컬 앱이 PC 사양과 설치된 모델을 확인하고, 같은 문항 생성 화면에서 로컬 모델을 선택합니다.</p></div></div><a href="https://ollama.com/download/windows" target="_blank" rel="noreferrer" className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#173B53] px-4 text-sm font-medium text-white hover:bg-[#102C40]"><ExternalLink className="mr-2 h-4 w-4" />Ollama 설치 파일 열기</a></div>
      <ol className="mt-5 grid gap-3 md:grid-cols-3"><li className="rounded-xl border border-[#D6EBE2] bg-white/80 p-3 text-sm"><strong className="block text-[#183248]">1. 설치</strong><span className="mt-1 block text-slate-600">공식 설치 파일을 실행합니다. 관리자 권한이나 명령 입력이 기본적으로 필요하지 않습니다.</span></li><li className="rounded-xl border border-[#D6EBE2] bg-white/80 p-3 text-sm"><strong className="block text-[#183248]">2. PC 확인</strong><span className="mt-1 block text-slate-600">데스크톱 앱에서 메모리·GPU·저장공간을 확인해 적절한 모델을 안내합니다.</span></li><li className="rounded-xl border border-[#D6EBE2] bg-white/80 p-3 text-sm"><strong className="block text-[#183248]">3. 모델 준비</strong><span className="mt-1 block text-slate-600">추천 모델과 라이선스를 확인한 뒤 직접 다운로드를 승인합니다.</span></li></ol>
      <p className="mt-4 text-xs leading-5 text-[#477164]">현재 웹앱은 브라우저 보안상 교사 PC의 사양·Ollama 상태를 직접 읽지 않습니다. 이 확인과 자동 추천은 동일 UI를 가진 데스크톱 앱에서 활성화됩니다.</p>
      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#F3D6A3] bg-[#FFF9EC] p-4 md:flex-row md:items-center md:justify-between"><div className="flex gap-2"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#B56716]" /><p className="text-xs leading-5 text-slate-700"><strong>Windows 테스트 설치 파일</strong><br />코드 서명 전 테스트 버전입니다. 모바일에서는 내려받을 필요가 없으며, 나중에 Windows PC에서 공식 안내와 SHA-256 값을 확인한 뒤 설치하세요.</p></div><a href={LOCAL_TEST_INSTALLER_URL} download className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-[#D9B46B] bg-white px-3 text-xs font-semibold text-[#8C5A14] hover:bg-[#FFF7E8]">테스트 설치 파일 받기</a></div>
    </section>

    <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.95fr]">
      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-[#183248]">새 제공자 연결</h2>
        <div className="mt-5 grid gap-4">
          <div><Label>실행 방식</Label><select value={type} onChange={event => changeType(event.target.value as ProviderType)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="ollama">내 PC의 Ollama (로컬)</option><option value="gemini">개인 Gemini API</option><option value="openai_compatible">개인 OpenAI API</option><option value="anthropic">개인 Claude API</option></select></div>
          <div><Label>표시 이름</Label><Input value={label} onChange={event => setLabel(event.target.value)} className="mt-1.5" /></div>
          {type !== "gemini" && type !== "ollama" && type !== "anthropic" && <div><Label>API 기본 주소<HelpTip>개인 API 제공자가 알려 준 기본 주소입니다. 보통 제공자가 안내한 값을 그대로 사용합니다.</HelpTip></Label><Input value={baseUrl} onChange={event => setBaseUrl(event.target.value)} placeholder={defaults[type].baseUrl} className="mt-1.5" /></div>}
          {type === "ollama" && <div className="rounded-xl border border-[#D6EBE2] bg-[#F2FBF6] p-3 text-xs leading-5 text-slate-600"><strong className="text-[#183248]">로컬 연결은 자동으로 처리됩니다.</strong> 주소를 입력할 필요가 없습니다. 데스크톱 앱이 교사 PC 안의 안전한 연결 주소만 사용합니다.<HelpTip>로컬 주소는 내 PC 안에서만 AI와 통신하는 연결 정보입니다. 외부 인터넷 주소가 아니므로 직접 수정하지 않아도 됩니다.</HelpTip></div>}
          <div><Label>모델 이름<HelpTip>권장 모델을 누르면 이름이 자동 입력됩니다. 키별 지원 모델은 다를 수 있으므로 연결 확인 결과를 함께 확인하세요.</HelpTip></Label><Input value={model} onChange={event => setModel(event.target.value)} className="mt-1.5" placeholder="예: claude-sonnet-5" />{type === "ollama" && <div className="mt-2 flex flex-wrap gap-2">{localRecommendations.map(item => <Button key={item.model} type="button" size="sm" variant={model === item.model ? "default" : "outline"} onClick={() => setModel(item.model)} className={model === item.model ? "bg-[#15856B] hover:bg-[#106C58]" : ""}>{item.tier} · {item.model}</Button>)}</div>}{selectedCatalog && <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-[#183248]">권장 모델</p><a href={selectedCatalog.documentationUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-[#15856B] hover:underline">공식 모델 안내</a></div><p className="mt-1 text-xs leading-5 text-slate-500">{selectedCatalog.apiLabel}. 품질·비용 정책은 제공자 계정에서 직접 확인하세요.</p><div className="mt-2 flex flex-wrap gap-2">{selectedCatalog.recommendedModels.map(item => <Button key={item.model} type="button" size="sm" variant={model === item.model ? "default" : "outline"} onClick={() => setModel(item.model)} className={model === item.model ? "bg-[#2773A7] hover:bg-[#1F5D8A]" : ""}>{item.tier} · {item.model}</Button>)}</div><p className="mt-2 text-[11px] leading-4 text-slate-500">{selectedCatalog.recommendedModels.find(item => item.model === model)?.description || "권장 목록 밖 모델입니다. 제공자 계정에서 이 모델의 사용 가능 여부를 확인하세요."}</p></div>}</div>
          {type === "ollama" && <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600"><strong className="text-[#183248]">수동 모델 연결도 가능합니다.</strong> Ollama에 이미 설치한 모델 이름을 직접 입력하세요. Gemma 3n은 저사양·모바일 연구 후보이며, 실제 시험 문항은 근거·정답·해설을 반드시 검수하세요.</div>}
          {external && <><div><Label>개인 API 키<HelpTip>개인 API 제공자가 발급한 비밀 키입니다. 저장 후에는 전체 값을 다시 표시하지 않습니다.</HelpTip></Label><Input required type="password" autoComplete="off" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="저장 후에는 마지막 4자리만 표시됩니다." className="mt-1.5" /></div><label className="flex gap-2 rounded-xl border border-[#F3D6A3] bg-[#FFF9EC] p-3 text-sm leading-5 text-slate-700"><input required type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1" /><span>문항 조건, 선택한 근거 자료의 텍스트, 출제 요구사항이 선택한 외부 AI 제공자에게 전송됨을 확인했습니다.</span></label></>}
        </div>
        <Button disabled={create.isPending} className="mt-6 w-full bg-[#173B53] hover:bg-[#102C40]">{create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}안전하게 저장</Button>
      </form>

      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-[#7B56B3]" /><h2 className="font-bold text-[#183248]">나의 문항 작성 선호</h2></div><p className="mt-2 text-sm leading-6 text-slate-600">예: “보기는 간결하게 작성”, “계산 과정의 단위를 확인”, “탐구형 문항을 우선”. 공통 안전 규칙·교육과정 근거·기출 비복제 규칙보다 우선하지 않습니다.</p><Textarea value={customInstructions} onChange={event => setCustomInstructions(event.target.value)} maxLength={1200} className="mt-3 min-h-28" placeholder="개인화하고 싶은 문항 작성 선호를 적어 주세요." /><div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-slate-400">{customInstructions.length}/1200</span><Button type="button" size="sm" disabled={savePreferences.isPending} onClick={() => savePreferences.mutate({ customInstructions })} className="bg-[#7B56B3] hover:bg-[#644298]">{savePreferences.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1 h-3.5 w-3.5" />}선호 저장</Button></div><p className="mt-3 text-xs leading-5 text-[#8C5A14]">개인 외부 AI를 선택하면 이 지시문도 문항 생성 요청의 일부로 전송될 수 있습니다. 로컬 AI에서는 교사 PC 안에서만 사용됩니다.</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><Cloud className="h-5 w-5 text-[#2773A7]" /><h2 className="mt-3 font-bold text-[#183248]">등록된 제공자</h2><div className="mt-3 space-y-3">{providers.isLoading ? <p className="text-sm text-slate-500">설정을 불러오는 중입니다.</p> : providers.data?.length ? providers.data.map(provider => <div key={provider.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-[#183248]">{provider.label}</p><p className="mt-0.5 text-xs text-slate-500">{provider.providerType} · {provider.model}{provider.apiKeyHint ? ` · ${provider.apiKeyHint}` : ""}</p></div><Badge variant="secondary">{provider.providerType === "ollama" ? "데스크톱 앱 필요" : provider.lastVerificationStatus === "ready" ? "연결 확인" : "미확인"}</Badge></div>{provider.providerType === "ollama" ? <p className="mt-3 text-xs leading-5 text-slate-500">교사 PC의 Ollama 상태와 실제 호출은 데스크톱 앱이 설치된 환경에서만 확인할 수 있습니다.</p> : <Button type="button" size="sm" variant="outline" disabled={verify.isPending} onClick={() => verify.mutate({ id: provider.id })} className="mt-3">{verify.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}연결 확인</Button>}</div>) : <p className="text-sm text-slate-500">아직 등록한 개인·로컬 제공자가 없습니다. 기본 생성은 관리형 AI를 사용합니다.</p>}</div></div>
        <div className="rounded-2xl border border-[#F3D6A3] bg-[#FFF9EC] p-5"><TriangleAlert className="h-5 w-5 text-[#B56716]" /><p className="mt-2 text-sm leading-6 text-slate-700">개인 API의 무료 한도와 요금·모델 정책은 공급자별로 다릅니다. 생성 전에는 해당 계정의 활성 한도와 키 제한 설정을 확인하세요.</p></div>
      </div>
    </section>
  </div>;
}
