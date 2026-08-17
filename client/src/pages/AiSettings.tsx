import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Cloud, KeyRound, Laptop, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

type ProviderType = "ollama" | "openai_compatible" | "gemini";

const defaults: Record<ProviderType, { label: string; baseUrl: string; model: string }> = {
  ollama: { label: "내 PC의 Ollama", baseUrl: "http://127.0.0.1:11434", model: "qwen3:8b" },
  openai_compatible: { label: "개인 OpenAI 호환 API", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
  gemini: { label: "개인 Gemini API", baseUrl: "", model: "gemini-2.5-flash" },
};

export default function AiSettings() {
  const utils = trpc.useUtils();
  const providers = trpc.assessment.aiProviders.list.useQuery();
  const [type, setType] = useState<ProviderType>("ollama");
  const [label, setLabel] = useState(defaults.ollama.label);
  const [baseUrl, setBaseUrl] = useState(defaults.ollama.baseUrl);
  const [model, setModel] = useState(defaults.ollama.model);
  const [apiKey, setApiKey] = useState("");
  const [consent, setConsent] = useState(false);
  const external = type !== "ollama";
  const create = trpc.assessment.aiProviders.create.useMutation({
    onSuccess: () => { toast.success("AI 제공자 설정을 저장했습니다."); setApiKey(""); void utils.assessment.aiProviders.list.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const verify = trpc.assessment.aiProviders.verify.useMutation({
    onSuccess: result => { toast.success(`${result.message}${result.models.length ? ` · ${result.models.slice(0, 3).join(", ")}` : ""}`); void utils.assessment.aiProviders.list.invalidate(); },
    onError: error => toast.error(error.message),
  });

  const changeType = (next: ProviderType) => {
    setType(next); setLabel(defaults[next].label); setBaseUrl(defaults[next].baseUrl); setModel(defaults[next].model); setApiKey(""); setConsent(false);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({ providerType: type, label, baseUrl: baseUrl || undefined, model, apiKey: external ? apiKey : undefined, confirmExternalTransfer: external ? consent : false });
  };

  return <div className="mx-auto max-w-5xl">
    <Badge className="bg-[#E6F4EE] text-[#15856B] hover:bg-[#E6F4EE]">AI 실행 환경</Badge>
    <h1 className="mt-3 text-3xl font-bold text-[#183248]">AI 제공자 설정</h1>
    <p className="mt-2 max-w-3xl leading-6 text-slate-600">문항 원문 보안을 위해 로컬 Ollama를 우선 사용할 수 있으며, 개인 API는 전송 범위를 확인한 경우에만 사용합니다. API 키는 화면에 다시 표시하지 않고 암호화해 보관합니다.</p>
    <section className="mt-7 grid gap-5 lg:grid-cols-[1fr_0.95fr]">
      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-[#183248]">새 제공자 연결</h2>
        <div className="mt-5 grid gap-4">
          <div><Label>실행 방식</Label><select value={type} onChange={event => changeType(event.target.value as ProviderType)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="ollama">내 PC의 Ollama (로컬)</option><option value="gemini">개인 Gemini API</option><option value="openai_compatible">개인 OpenAI 호환 API</option></select></div>
          <div><Label>표시 이름</Label><Input value={label} onChange={event => setLabel(event.target.value)} className="mt-1.5" /></div>
          {type !== "gemini" && <div><Label>{type === "ollama" ? "로컬 주소" : "API 기본 주소"}</Label><Input value={baseUrl} onChange={event => setBaseUrl(event.target.value)} placeholder={defaults[type].baseUrl} className="mt-1.5" />{type === "ollama" && <p className="mt-1.5 text-xs text-slate-500">웹앱에서는 이 주소가 서버가 아닌 로컬 앱 브리지에서 확인됩니다.</p>}</div>}
          <div><Label>모델 이름</Label><Input value={model} onChange={event => setModel(event.target.value)} className="mt-1.5" /></div>
          {external && <><div><Label>개인 API 키</Label><Input required type="password" autoComplete="off" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="저장 후에는 마지막 4자리만 표시됩니다." className="mt-1.5" /></div><label className="flex gap-2 rounded-xl border border-[#F3D6A3] bg-[#FFF9EC] p-3 text-sm leading-5 text-slate-700"><input required type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1" /><span>문항 조건, 선택한 근거 자료의 텍스트, 출제 요구사항이 선택한 외부 AI 제공자에게 전송됨을 확인했습니다.</span></label></>}
        </div>
        <Button disabled={create.isPending} className="mt-6 w-full bg-[#173B53] hover:bg-[#102C40]">{create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}안전하게 저장</Button>
      </form>
      <div className="space-y-4">
        <div className="rounded-2xl border border-[#B9DCCF] bg-[#F2FBF6] p-5"><Laptop className="h-5 w-5 text-[#15856B]" /><h2 className="mt-3 font-bold text-[#183248]">로컬 우선</h2><p className="mt-2 text-sm leading-6 text-slate-600">로컬 Ollama는 로컬 앱에서 문항 원문을 외부로 보내지 않고 실행할 수 있습니다. 이 웹앱에서는 연결 설정을 준비하고, 실제 PC 연결은 로컬 브리지 버전에서 활성화합니다.</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><Cloud className="h-5 w-5 text-[#2773A7]" /><h2 className="mt-3 font-bold text-[#183248]">등록된 제공자</h2><div className="mt-3 space-y-3">{providers.isLoading ? <p className="text-sm text-slate-500">설정을 불러오는 중입니다.</p> : providers.data?.length ? providers.data.map(provider => <div key={provider.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-[#183248]">{provider.label}</p><p className="mt-0.5 text-xs text-slate-500">{provider.providerType} · {provider.model}{provider.apiKeyHint ? ` · ${provider.apiKeyHint}` : ""}</p></div><Badge variant="secondary">{provider.providerType === "ollama" ? "로컬 앱 필요" : provider.lastVerificationStatus === "ready" ? "연결 확인" : "미확인"}</Badge></div>{provider.providerType === "ollama" ? <p className="mt-3 text-xs leading-5 text-slate-500">교사 PC의 Ollama 상태 확인과 실제 호출은 로컬 앱 브리지가 설치된 환경에서만 가능합니다.</p> : <Button type="button" size="sm" variant="outline" disabled={verify.isPending} onClick={() => verify.mutate({ id: provider.id })} className="mt-3">{verify.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}연결 확인</Button>}</div>) : <p className="text-sm text-slate-500">아직 등록한 개인·로컬 제공자가 없습니다. 기본 생성은 관리형 AI를 사용합니다.</p>}</div></div>
        <div className="rounded-2xl border border-[#F3D6A3] bg-[#FFF9EC] p-5"><TriangleAlert className="h-5 w-5 text-[#B56716]" /><p className="mt-2 text-sm leading-6 text-slate-700">개인 API의 무료 한도와 요금·모델 정책은 공급자별로 달라집니다. 생성 전에는 해당 계정의 활성 한도와 키 제한 설정을 확인하세요.</p></div>
      </div>
    </section>
  </div>;
}
