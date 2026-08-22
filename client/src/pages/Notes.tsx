import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, Pin, Plus, StickyNote, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type NoteForm = { id?: number; title: string; content: string; isPinned: boolean };
const emptyNote: NoteForm = { title: "", content: "", isPinned: false };

export default function Notes() {
  const utils = trpc.useUtils();
  const notes = trpc.assessment.notes.list.useQuery();
  const [form, setForm] = useState<NoteForm>(emptyNote);
  const save = trpc.assessment.notes.create.useMutation({ onSuccess: () => { toast.success("메모를 저장했습니다."); setForm(emptyNote); void utils.assessment.notes.list.invalidate(); }, onError: error => toast.error(error.message) });
  const update = trpc.assessment.notes.update.useMutation({ onSuccess: () => { toast.success("메모를 수정했습니다."); setForm(emptyNote); void utils.assessment.notes.list.invalidate(); }, onError: error => toast.error(error.message) });
  const remove = trpc.assessment.notes.remove.useMutation({ onSuccess: () => { toast.success("메모를 삭제했습니다."); if (form.id) setForm(emptyNote); void utils.assessment.notes.list.invalidate(); }, onError: error => toast.error(error.message) });

  useEffect(() => { if (form.id && !notes.data?.some(note => note.id === form.id)) setForm(emptyNote); }, [form.id, notes.data]);
  const submit = (event: React.FormEvent) => { event.preventDefault(); const payload = { title: form.title.trim(), content: form.content.trim(), isPinned: form.isPinned }; if (!payload.title || !payload.content) return toast.error("메모 제목과 내용을 입력해 주세요."); if (form.id) update.mutate({ id: form.id, ...payload }); else save.mutate(payload); };
  const pending = save.isPending || update.isPending;

  return <div className="mx-auto max-w-6xl">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[#15856B]">교사 작업 메모</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-[#183248]">메모장</h1><p className="mt-2 text-slate-500">교사의 생각과 준비 사항을 플랫폼 안에 간단히 정리합니다. 메모 내용은 AI 생성 요청에 자동으로 포함되지 않습니다.</p></div><Button variant="outline" onClick={() => setForm(emptyNote)} className="w-fit border-[#9CCFC0] text-[#116B58]"><Plus className="mr-2 h-4 w-4" />새 메모</Button></div>
    <section className="mt-7 grid gap-5 lg:grid-cols-[390px_1fr]">
      <form onSubmit={submit} className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-[#183248]">{form.id ? "메모 수정" : "새 메모"}</h2><div className="mt-5 space-y-4"><div><Label htmlFor="note-title">제목</Label><Input id="note-title" maxLength={160} value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="예: 다음 단원 평가 준비" className="mt-1.5" /></div><div><Label htmlFor="note-content">내용</Label><Textarea id="note-content" maxLength={12_000} value={form.content} onChange={event => setForm(current => ({ ...current, content: event.target.value }))} placeholder="수업 중 확인할 사항, 문항 아이디어, 검수할 내용을 적어 두세요." className="mt-1.5 min-h-56 resize-y" /></div><label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.isPinned} onChange={event => setForm(current => ({ ...current, isPinned: event.target.checked }))} /><Pin className="h-3.5 w-3.5 text-[#15856B]" />상단에 고정</label></div><div className="mt-5 flex gap-2"><Button type="submit" disabled={pending} className="flex-1 bg-[#15856B] hover:bg-[#106C58]">{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{form.id ? "수정 저장" : "메모 저장"}</Button>{form.id ? <Button type="button" variant="outline" onClick={() => setForm(emptyNote)}>취소</Button> : null}</div></form>
      <div className="grid gap-4 sm:grid-cols-2">{notes.isLoading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />메모를 불러오는 중입니다.</div> : notes.data?.length ? notes.data.map(note => <article key={note.id} className={`group flex min-h-52 flex-col rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${form.id === note.id ? "border-[#52B788] ring-2 ring-[#DDF3E9]" : "border-slate-200"}`}><div className="flex items-start justify-between gap-3"><button type="button" onClick={() => setForm({ id: note.id, title: note.title, content: note.content, isPinned: Boolean(note.isPinned) })} className="min-w-0 text-left"><div className="flex items-center gap-2"><h2 className="truncate font-bold text-[#183248]">{note.title}</h2>{note.isPinned ? <Pin className="h-3.5 w-3.5 shrink-0 fill-[#15856B] text-[#15856B]" /> : null}</div><p className="mt-1 text-[11px] text-slate-400">{new Date(note.updatedAt).toLocaleString("ko-KR")}</p></button><Button aria-label={`${note.title} 삭제`} size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => { if (window.confirm("이 메모를 삭제할까요?")) remove.mutate({ id: note.id }); }}><Trash2 className="h-4 w-4" /></Button></div><button type="button" onClick={() => setForm({ id: note.id, title: note.title, content: note.content, isPinned: Boolean(note.isPinned) })} className="mt-4 line-clamp-6 text-left text-sm leading-6 text-slate-600">{note.content}</button></article>) : <div className="rounded-2xl border border-dashed border-[#B9DCCF] bg-[#F7FCF9] p-8 text-center sm:col-span-2"><StickyNote className="mx-auto h-7 w-7 text-[#15856B]" /><h2 className="mt-3 font-semibold text-[#183248]">첫 작업 메모를 남겨 보세요.</h2><p className="mt-2 text-sm leading-6 text-slate-500">문항 아이디어, 수업 후 확인할 사항, 검수 계획을 별도로 정리할 수 있습니다.</p></div>}</div>
    </section>
  </div>;
}
