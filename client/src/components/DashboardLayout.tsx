import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { startLogin } from "@/const";
import {
  BookOpenCheck,
  ClipboardList,
  FileArchive,
  LayoutDashboard,
  Cpu,
  LogOut,
  PanelLeft,
  ShieldCheck,
  ScrollText,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const menuItems = [
  { icon: LayoutDashboard, label: "대시보드", path: "/" },
  { icon: FileArchive, label: "참고 자료", path: "/materials" },
  { icon: ClipboardList, label: "기출문제", path: "/references" },
  { icon: Sparkles, label: "문항 생성", path: "/generate" },
  { icon: Cpu, label: "AI 설정", path: "/ai-settings" },
  { icon: ShieldCheck, label: "검수함", path: "/review" },
  { icon: BookOpenCheck, label: "승인 문항", path: "/approved" },
  { icon: ScrollText, label: "운영 정책", path: "/policies" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [inviteCode, setInviteCode] = useState("");
  const [guestPassword, setGuestPassword] = useState("");
  const utils = trpc.useUtils();
  const pilotStatus = trpc.auth.pilotStatus.useQuery(undefined, { retry: false });
  const verifyPilotAccess = trpc.auth.pilotAccess.useMutation({
    onSuccess: () => { toast.success("파일럿 접근을 확인했습니다."); void utils.auth.pilotStatus.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const guestLogin = trpc.auth.guestLogin.useMutation({
    onSuccess: () => { toast.success("게스트로 로그인했습니다."); setGuestPassword(""); void utils.auth.me.invalidate(); },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("invite");
    if (!code || pilotStatus.data?.granted || verifyPilotAccess.isPending) return;
    verifyPilotAccess.mutate({ inviteCode: code });
    window.history.replaceState({}, "", window.location.pathname);
  }, [pilotStatus.data?.granted, verifyPilotAccess]);

  if (loading || pilotStatus.isLoading) {
    return <div className="min-h-screen bg-[#F6F7F5] grid place-items-center text-sm text-slate-500">교사도우미를 준비하고 있습니다.</div>;
  }

  if (!pilotStatus.data?.granted) {
    return <div className="min-h-screen bg-[#F6F7F5] grid place-items-center px-5"><section className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-9 shadow-[0_20px_70px_rgba(28,51,70,0.10)]"><div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#173B53] text-white"><ShieldCheck className="h-6 w-6" /></div><p className="text-sm font-bold tracking-[0.14em] text-[#15856B]">INVITATION-ONLY PILOT</p><h1 className="mt-3 text-3xl font-bold tracking-tight text-[#183248]">공유 링크로만<br />접근할 수 있습니다.</h1><p className="mt-4 leading-7 text-slate-600">파일럿 참여자에게 받은 링크를 열었거나, 초대 코드를 입력해 접근을 확인해 주세요.</p><form className="mt-7 space-y-3" onSubmit={event => { event.preventDefault(); verifyPilotAccess.mutate({ inviteCode }); }}><Input value={inviteCode} onChange={event => setInviteCode(event.target.value)} placeholder="파일럿 접근 코드" autoComplete="off" /><Button type="submit" className="h-11 w-full bg-[#173B53] hover:bg-[#102C40]" disabled={!inviteCode || verifyPilotAccess.isPending}>{verifyPilotAccess.isPending ? "확인 중…" : "접근 확인"}</Button></form></section></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F6F7F5] grid place-items-center px-5">
        <section className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-9 shadow-[0_20px_70px_rgba(28,51,70,0.10)]">
          <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#173B53] text-white"><BookOpenCheck className="h-6 w-6" /></div>
          <p className="text-sm font-bold tracking-[0.14em] text-[#15856B]">TEACHER ASSESSMENT WORKSPACE</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#183248]">근거를 확인하며<br />문항을 만드세요.</h1>
          <p className="mt-4 leading-7 text-slate-600">교사도우미는 교육과정, 기출문제, 출제 지침을 근거로 문항을 만들고 검수 과정을 기록하는 출제 보조 시스템입니다.</p>
          <Button className="mt-8 h-12 w-full rounded-xl bg-[#173B53] text-base hover:bg-[#102C40]" onClick={() => startLogin()}>교사 로그인</Button>
          <div className="mt-5 border-t border-slate-100 pt-5"><p className="text-sm font-semibold text-[#183248]">파일럿 게스트 로그인</p><p className="mt-1 text-xs leading-5 text-slate-500">ID는 <strong>guest</strong>로 고정된 1인 테스트용 계정입니다. 이 계정의 자료·문항은 같은 게스트 계정 사용자와 공유될 수 있습니다.</p><form className="mt-3 flex gap-2" onSubmit={event => { event.preventDefault(); guestLogin.mutate({ username: "guest", password: guestPassword }); }}><Input aria-label="게스트 비밀번호" type="password" value={guestPassword} onChange={event => setGuestPassword(event.target.value)} placeholder="게스트 비밀번호" autoComplete="current-password" /><Button type="submit" className="shrink-0 bg-[#15856B] hover:bg-[#106C58]" disabled={!guestPassword || guestLogin.isPending}>{guestLogin.isPending ? "로그인 중" : "게스트 로그인"}</Button></form></div>
          <p className="mt-4 text-center text-xs text-slate-400">AI가 작성한 결과는 교사의 최종 검수가 필요합니다.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F7F5] text-slate-800">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-[#173B53] px-4 py-5 text-slate-100 md:flex">
        <button onClick={() => setLocation("/")} className="mb-10 flex items-center gap-3 px-2 text-left">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#52B788] text-[#123144]"><BookOpenCheck className="h-5 w-5" /></span>
          <span><strong className="block text-[15px] tracking-tight">교사도우미</strong><small className="text-[11px] text-slate-300">근거 기반 출제 보조</small></span>
        </button>
        <nav className="space-y-1">
          {[...menuItems, ...(user.role === "admin" ? [{ icon: UsersRound, label: "운영 도구", path: "/admin" }] : [])].map(item => {
            const active = location === item.path;
            return <button key={item.path} onClick={() => setLocation(item.path)} className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm transition ${active ? "bg-white/14 font-semibold text-white" : "text-slate-300 hover:bg-white/8 hover:text-white"}`}>
              <item.icon className="h-4 w-4" />{item.label}
            </button>;
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-white/10 bg-white/7 p-3">
          <p className="text-xs leading-5 text-slate-300">문항 생성 결과는 검수함에서 근거와 함께 확인할 수 있습니다.</p>
        </div>
      </aside>
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200/90 bg-[#F6F7F5]/90 px-4 backdrop-blur md:ml-64 md:px-8">
        <button onClick={() => setLocation("/")} className="flex items-center gap-2 font-bold text-[#183248] md:hidden"><PanelLeft className="h-5 w-5" />교사도우미</button>
        <div className="hidden text-sm text-slate-500 md:block">화학 I 파일럿 · 근거 기반 문항 관리</div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-xl p-1.5 text-left hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15856B]">
              <Avatar className="h-8 w-8 border border-slate-200"><AvatarFallback className="bg-white text-xs font-bold text-[#173B53]">{user.name?.slice(0, 1) || "교"}</AvatarFallback></Avatar>
              <span className="hidden sm:block"><span className="block text-xs font-semibold leading-4">{user.name || "교사"}</span><Badge variant="secondary" className="mt-0.5 h-4 px-1.5 text-[10px]">{user.role === "admin" ? "관리자" : "교사"}</Badge></span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44"><DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600 focus:text-red-600"><LogOut className="mr-2 h-4 w-4" />로그아웃</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
      </header>
      <main className="min-h-[calc(100vh-4rem)] px-4 py-6 md:ml-64 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
