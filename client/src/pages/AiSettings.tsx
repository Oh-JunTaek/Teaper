import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Cloud, ExternalLink, KeyRound, Laptop, Loader2, ShieldCheck, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

type ProviderType = "ollama" | "openai_compatible" | "gemini";

const defaults: Record<ProviderType, { label: string; baseUrl: string; model: string }> = {
  ollama: { label: "내 PC의 Ollama", baseUrl: "http://127.0.0.1:11434", model: "qwen3:8b" },
  openai_compatible: { label: "개인 OpenAI 호환 API", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
  gemini: { label: "개인 Gemini API", baseUrl: "", model: "gemini-2.5-flash" },
};

const localRecommendations = [
  { model: "qwen3:4b", tier: "경량", requirement: "메모리 8GB 이상", use: "처음 시작하거나 GPU가 없는 PC" },
  { model: "qwen3:8b", tier: "표준", requirement: "메모리 16GB 또는 VRAM 6GB 이상", use: "일반 화학 I 출제 보조" },
  { model: "qwen3:14b", tier: "권장", requirement: "메모리 32GB 또는 VRAM 10GB 이상", use: "복잡한 근거와 해설 품질 우선" },
];

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

    <section className="mt-7 rounded-2xl border border-[#B9DCCF] bg-[#F2FBF6] p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#15856B]"><Laptop className="h-5 w-5" /></span><div><h2 className="font-bold text-[#183248]">로컬 AI를 처음 준비하시나요?</h2><p className="mt-1 text-sm leading-6 text-slate-600">비개발자 교사는 CMD 입력보다 Ollama 설치 파일 방식을 권장합니다. 설치 후 로컬 앱이 PC 사양과 설치된 모델을 확인하고, 같은 문항 생성 화면에서 로컬 모델을 선택합니다.</p></div></div><a href="https://ollama.com/download/windows" target="_blank" rel="noreferrer" className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#173B53] px-4 text-sm font-medium text-white hover:bg-[#102C40]"><ExternalLink className="mr-2 h-4 w-4" />Ollama 설치 파일 열기</a></div>
      <ol className="mt-5 grid gap-3 md:grid-cols-3"><li className="rounded-xl border border-[#D6EBE2] bg-white/80 p-3 text-sm"><strong className="block text-[#183248]">1. 설치</strong><span className="mt-1 block text-slate-600">공식 설치 파일을 실행합니다. 관리자 권한이나 명령 입력이 기본적으로 필요하지 않습니다.</span></li><li className="rounded-xl border border-[#D6EBE2] bg-white/80 p-3 text-sm"><strong className="block text-[#183248]">2. PC 확인</strong><span className="mt-1 block text-slate-600">데스크톱 앱에서 메모리·GPU·저장공간을 확인해 적절한 모델을 안내합니다.</span></li><li className="rounded-xl border border-[#D6EBE2] bg-white/80 p-3 text-sm"><strong className="block text-[#183248]">3. 모델 준비</strong><span className="mt-1 block text-slate-600">추천 모델과 라이선스를 확인한 뒤 직접 다운로드를 승인합니다.</span></li></ol>
      <p className="mt-4 text-xs leading-5 text-[#477164]">현재 웹앱은 브라우저 보안상 교사 PC의 사양·Ollama 상태를 직접 읽지 않습니다. 이 확인과 자동 추천은 동일 UI를 가진 데스크톱 앱에서 활성화됩니다.</p>
    </section>

    <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.95fr]">
      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-[#183248]">새 제공자 연결</h2>
        <div className="mt-5 grid gap-4">
          <div><Label>실행 방식</Label><select value={type} onChange={event => changeType(event.target.value as ProviderType)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="ollama">내 PC의 Ollama (로컬)</option><option value="gemini">개인 Gemini API</option><option value="openai_compatible">개인 OpenAI 호환 API</option></select></div>
          <div><Label>표시 이름</Label><Input value={label} onChange={event => setLabel(event.target.value)} className="mt-1.5" /></div>
          {type !== "gemini" && <div><Label>{type === "ollama" ? "로컬 주소" : "API 기본 주소"}</Label><Input value={baseUrl} onChange={event => setBaseUrl(event.target.value)} placeholder={defaults[type].baseUrl} className="mt-1.5" />{type === "ollama" && <p className="mt-1.5 text-xs text-slate-500">웹앱에서는 이 주소가 교사 PC로 연결되지 않습니다. 데스크톱 앱에서만 local-only bridge를 통해 확인합니다.</p>}</div>}
          <div><Label>모델 이름</Label><Input value={model} onChange={event => setModel(event.target.value)} className="mt-1.5" placeholder="예: qwen3:8b" />{type === "ollama" && <div className="mt-2 flex flex-wrap gap-2">{localRecommendations.map(item => <Button key={item.model} type="button" size="sm" variant={model === item.model ? "default" : "outline"} onClick={() => setModel(item.model)} className={model === item.model ? "bg-[#15856B] hover:bg-[#106C58]" : ""}>{item.tier} · {item.model}</Button>)}</div>}</div>
          {type === "ollama" && <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600"><strong className="text-[#183248]">수동 모델 연결도 가능합니다.</strong> Ollama에 이미 설치한 모델 이름을 직접 입력하세요. 권장 모델은 데스크톱 앱이 PC 사양을 확인한 뒤 다시 제안합니다.</div>}
          {external && <><div><Label>개인 API 키</Label><Input required type="password" autoComplete="off" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="저장 후에는 마지막 4자리만 표시됩니다." className="mt-1.5" /></div><label className="flex gap-2 rounded-xl border border-[#F3D6A3] bg-[#FFF9EC] p-3 text-sm leading-5 text-slate-700"><input required type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1" /><span>문항 조건, 선택한 근거 자료의 텍스트, 출제 요구사항이 선택한 외부 AI 제공자에게 전송됨을 확인했습니다.</span></label></>}
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
