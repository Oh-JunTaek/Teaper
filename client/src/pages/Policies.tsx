import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertTriangle, Bot, ExternalLink, FileText, LockKeyhole, ShieldCheck, UsersRound } from "lucide-react";
import { useLocation } from "wouter";

const KICE_URL = "https://www.suneung.re.kr/boardCnts/list.do?boardID=1500234&m=0403&s=suneung";

const policies = [
  { id: "ai", icon: Bot, title: "AI 생성·교사 최종 검수", text: "문항은 생성형 AI가 보조할 수 있으며, 교사는 근거·정답·해설·난이도를 최종 검수해야 합니다. 생성 제공자·모델·근거·검증 이력을 확인할 수 있습니다." },
  { id: "security", icon: LockKeyhole, title: "문항·계정 보안", text: "교사별 작업공간을 분리하며 다른 교사에게 문항을 자동 공유하지 않습니다. 출시 예정 문항은 학교·기관의 평가 보안 지침을 우선 적용합니다." },
  { id: "data", icon: ShieldCheck, title: "개인정보·자료 최소화", text: "학생 성명·성적·상담·건강 정보 등은 등록하지 않아야 합니다. 개인 API 키는 암호화하고 화면·로그·내보내기에 포함하지 않습니다." },
  { id: "rights", icon: FileText, title: "저작권·기출문제", text: "기출·교재·학교 자료는 이용 권한을 확인한 뒤 등록해야 합니다. 공식 기출은 링크·메타데이터를 우선 제공하며 원문을 공용으로 복제·재배포하지 않습니다." },
  { id: "external", icon: ExternalLink, title: "외부 AI와 로컬 실행", text: "개인 외부 AI는 전송될 항목을 미리 보여주고 요청별 동의를 받습니다. 로컬 AI는 교사 PC에서 실행해 자료·문항 원문을 PC 밖으로 보내지 않는 방식을 지향합니다." },
  { id: "support", icon: UsersRound, title: "삭제·문의·운영 변경", text: "교사는 자료를 삭제하고 문항을 내보낼 수 있습니다. 정식 공개 전 보유기간·문의처·침해 대응·이의 제기 절차를 확정해 공개합니다." },
];

export default function Policies() {
  const [, setLocation] = useLocation();
  return <div className="mx-auto max-w-4xl pb-10">
    <div><Badge className="bg-[#E6F4EE] text-[#15856B] hover:bg-[#E6F4EE]">EunmaStudio · 개인 교사 파일럿</Badge><h1 className="mt-3 text-3xl font-bold text-[#183248]">서비스 운영 정책</h1><p className="mt-2 max-w-3xl leading-6 text-slate-600">교사도우미는 근거를 확인하며 문항을 생성하고, 교사가 최종 검수하도록 돕는 출제 보조 서비스입니다. 아래는 현재 파일럿 운영 원칙과 정식 공개 전 확정할 항목입니다.</p></div>
    <div className="mt-6 rounded-2xl border border-[#F3D6A3] bg-[#FFF9EC] p-5 text-sm leading-6 text-[#80551B]"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><strong>정식 공개 전 확정 항목.</strong> 사업자·문의처·개인정보 보호책임자·보유기간·삭제 방식·외부 AI 이전 구조·침해 대응 연락망은 실제 운영 구조와 전문가 검토를 거쳐 확정·공개합니다.</div></div></div>
    <section className="mt-6 grid gap-4 md:grid-cols-2">{policies.map(item => { const Icon = item.icon; return <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-[#15856B]" /><h2 className="mt-3 font-bold text-[#183248]">{item.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p></article>; })}</section>
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold text-[#183248]">운영 원칙 상세</h2><Accordion type="single" collapsible className="mt-3"><AccordionItem value="privacy"><AccordionTrigger>개인정보·국외이전·이용자 권리</AccordionTrigger><AccordionContent className="leading-6 text-slate-600">서비스는 필요한 정보만 처리하고, 익명 통계는 정책 확정 전 수집하지 않습니다. 외부 AI 선택 시 전송 범위를 확인하고 요청별 동의를 받습니다. 개인정보의 열람·정정·삭제·처리정지 요청 경로와 실제 보관기간은 정식 공개 전 확정합니다.</AccordionContent></AccordionItem><AccordionItem value="incident"><AccordionTrigger>보안 사고·저작권 신고·장애 대응</AccordionTrigger><AccordionContent className="leading-6 text-slate-600">사고가 의심되면 접근·전송을 격리하고 증거를 보존하며, 영향 범위와 통지·신고 요건을 판단합니다. 권리자·기관의 자료 삭제 또는 보안 요청은 관련 자료·근거·내보내기를 우선 격리해 검토합니다.</AccordionContent></AccordionItem><AccordionItem value="institution"><AccordionTrigger>기관 도입·유료화 시 추가되는 정책</AccordionTrigger><AccordionContent className="leading-6 text-slate-600">기관 관리자·공동 출제·감사 로그·처리위탁·SLA·데이터 반환·계약, 가격·결제·환불·분쟁 처리는 개인 교사 파일럿과 분리해 도입 전에 확정합니다.</AccordionContent></AccordionItem></Accordion></section>
    <section className="mt-5 rounded-2xl border border-[#B9DCCF] bg-[#F2FBF6] p-6"><h2 className="font-bold text-[#183248]">공식 기출문제 안내</h2><p className="mt-2 text-sm leading-6 text-slate-600">공식 기출은 제공처를 확인하고, 개인 작업공간에서 이용 권한·출처·페이지를 기록해 등록하세요. 서비스는 원문을 기본으로 복제·공유하지 않습니다.</p><div className="mt-4 flex flex-wrap gap-2"><a href={KICE_URL} target="_blank" rel="noreferrer"><Button variant="outline" className="border-[#7EBEAE] bg-white text-[#116B58]"><ExternalLink className="mr-2 h-4 w-4" />공식 기출문제 제공처</Button></a><Button onClick={() => setLocation("/references")} className="bg-[#15856B] hover:bg-[#106C58]">기출 직접 등록</Button></div></section>
  </div>;
}
