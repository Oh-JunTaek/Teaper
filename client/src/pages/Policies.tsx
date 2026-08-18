import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";

const KICE_URL = "https://www.suneung.re.kr/boardCnts/list.do?boardID=1500234&m=0403&s=suneung";

export default function Policies() {
  const [, setLocation] = useLocation();
  return <div className="mx-auto max-w-4xl">
    <div><Badge className="bg-[#E6F4EE] text-[#15856B] hover:bg-[#E6F4EE]">EunmaStudio</Badge><h1 className="mt-3 text-3xl font-bold text-[#183248]">서비스 운영 정책</h1><p className="mt-2 text-slate-500">교사도우미는 근거를 확인하며 문항 초안을 만들고, 교사가 최종 검수하는 출제 보조 서비스입니다.</p></div>
    <div className="mt-6 rounded-2xl border border-[#F3D6A3] bg-[#FFF9EC] p-5 text-sm leading-6 text-[#80551B]"><strong>공개 전 검토 안내.</strong> 이 페이지는 EunmaStudio의 운영 정책 초안입니다. 정식 공개 전 사업자·문의처·보관기간·개인정보 보호책임자 정보와 전문 검토 결과를 반영합니다.</div>
    <section className="mt-6 grid gap-4 md:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><ShieldCheck className="h-5 w-5 text-[#15856B]" /><h2 className="mt-3 font-bold text-[#183248]">문항·계정 보안</h2><p className="mt-2 text-sm leading-6 text-slate-600">교사가 만든 문항은 다른 교사에게 공유하지 않으며, 운영 목적의 최소 관리자만 접근합니다. 시험 사용 전에는 교사가 최종 검수해야 합니다.</p></article><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><FileText className="h-5 w-5 text-[#2D6496]" /><h2 className="mt-3 font-bold text-[#183248]">자료 권리와 개인정보</h2><p className="mt-2 text-sm leading-6 text-slate-600">자료를 등록하는 교사는 이용 권한을 확인해야 하며, 학생 개인정보나 불필요한 민감 정보는 입력하지 않아야 합니다.</p></article></section>
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold text-[#183248]">외부 AI 사용 원칙</h2><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600"><li>• 개인 외부 AI를 선택하면 전송될 근거·프롬프트 구성·최대 호출 수를 먼저 표시합니다.</li><li>• 요청별 동의 없이 외부 AI로 자료를 전송하지 않습니다.</li><li>• 개인 API 키는 화면과 내보내기에 표시하지 않으며 암호화해 처리합니다.</li></ul></section>
    <section className="mt-5 rounded-2xl border border-[#B9DCCF] bg-[#F2FBF6] p-6"><h2 className="font-bold text-[#183248]">공식 기출문제 안내</h2><p className="mt-2 text-sm leading-6 text-slate-600">한국교육과정평가원은 기출문제의 저작권을 고지하고 무단 복제·배포·출판을 금지합니다. 교사도우미는 원문을 기본으로 복제하지 않고 공식 제공처와 사용자 직접 등록 흐름을 제공합니다.</p><div className="mt-4 flex flex-wrap gap-2"><a href={KICE_URL} target="_blank" rel="noreferrer"><Button variant="outline" className="border-[#7EBEAE] bg-white text-[#116B58]"><ExternalLink className="mr-2 h-4 w-4" />공식 기출문제 제공처</Button></a><Button onClick={() => setLocation("/references")} className="bg-[#15856B] hover:bg-[#106C58]">직접 등록하기</Button></div></section>
  </div>;
}
