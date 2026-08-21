import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createQuestionDocx, openQuestionPrintView } from "@/lib/questionExport";
import type { ExportQuestion, ExportVisualSpec, QuestionDocumentKind } from "@/lib/questionExport";
import { trpc } from "@/lib/trpc";
import { Download, FileDown, FileSpreadsheet, FileText, Printer, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Approved() {
  const { data: questions, isLoading } = trpc.assessment.questions.list.useQuery({ status: "approved" });
  const { data: exportData, refetch } = trpc.assessment.questions.exportCsv.useQuery(undefined, { enabled: false });
  const [isExporting, setIsExporting] = useState(false);
  const exportQuestions: ExportQuestion[] = (questions || []).map(question => ({ ...question, visualSpec: question.visualSpec as ExportVisualSpec | null }));

  const requireQuestions = () => {
    if (exportQuestions.length) return true;
    toast.error("내보낼 승인 문항이 없습니다.");
    return false;
  };

  const downloadCsv = async () => {
    const result = exportData ?? (await refetch()).data;
    if (!result?.count) return toast.error("내보낼 승인 문항이 없습니다.");
    downloadBlob(new Blob([`\ufeff${result.csv}`], { type: "text/csv;charset=utf-8" }), "승인-문항-목록.csv");
    toast.success(`${result.count}개 승인 문항을 CSV로 내보냈습니다.`);
  };

  const downloadDocx = async (kind: QuestionDocumentKind) => {
    if (!requireQuestions()) return;
    setIsExporting(true);
    try {
      const blob = await createQuestionDocx(exportQuestions, kind);
      downloadBlob(blob, kind === "question-paper" ? "문항-시험지.docx" : "문항-정답-해설지.docx");
      toast.success(kind === "question-paper" ? "시험지 DOCX를 만들었습니다." : "정답·해설지 DOCX를 만들었습니다.");
    } catch {
      toast.error("문서 파일을 만들지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setIsExporting(false);
    }
  };

  const printPdf = (kind: QuestionDocumentKind) => {
    if (!requireQuestions()) return;
    if (!openQuestionPrintView(exportQuestions, kind)) return toast.error("인쇄 창을 열지 못했습니다. 브라우저 팝업 차단 설정을 확인해 주세요.");
    toast.message("인쇄 창에서 프린터 또는 ‘PDF로 저장’을 선택해 주세요.");
  };

  return <div className="mx-auto max-w-6xl">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div><p className="text-sm font-semibold text-[#15856B]">APPROVED ITEM BANK</p><h1 className="mt-1 text-3xl font-bold text-[#183248]">승인 문항</h1><p className="mt-2 text-slate-500">최종 승인된 문항과 생성 모델·프롬프트 버전을 관리합니다.</p></div>
      <AlertDialog><AlertDialogTrigger asChild><Button className="h-11 rounded-xl bg-[#173B53] hover:bg-[#102C40]"><Download className="mr-2 h-4 w-4" />문서·PDF 내보내기</Button></AlertDialogTrigger><AlertDialogContent className="max-w-lg"><AlertDialogHeader><AlertDialogTitle>승인 문항 내보내기</AlertDialogTitle><AlertDialogDescription className="leading-6">내보낸 파일에는 시험 문항과 정답·해설이 포함될 수 있습니다. 학교의 시험 보안 지침에 맞는 저장 위치와 출력 장치를 사용해 주세요.</AlertDialogDescription></AlertDialogHeader><div className="space-y-2 rounded-lg border border-[#B9DCCF] bg-[#F2FBF6] p-3 text-sm text-slate-700"><div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#15856B]" /><p><strong>문서 호환:</strong> DOCX는 Word와 최신 한글에서 열 수 있습니다. 한글 전용 형식이 필요하면 한글에서 열어 HWPX로 다시 저장해 주세요.</p></div><p className="pl-6 text-xs text-slate-500">구형 HWP 직접 출력은 지원하지 않습니다. 그래프·표는 최신 Word 또는 한글에서 열어 최종 모양을 확인해 주세요.</p></div><div className="grid gap-2 sm:grid-cols-2"><AlertDialogAction asChild><Button variant="outline" disabled={isExporting} onClick={() => downloadDocx("question-paper")} className="h-auto justify-start border-slate-200 bg-white py-3 text-left hover:bg-slate-50"><FileText className="mr-3 h-5 w-5 text-[#2D6496]" /><span><strong className="block">시험지 DOCX</strong><small className="text-slate-500">문항·보기·그래프·표</small></span></Button></AlertDialogAction><AlertDialogAction asChild><Button variant="outline" disabled={isExporting} onClick={() => downloadDocx("answer-sheet")} className="h-auto justify-start border-slate-200 bg-white py-3 text-left hover:bg-slate-50"><FileText className="mr-3 h-5 w-5 text-[#15856B]" /><span><strong className="block">정답·해설 DOCX</strong><small className="text-slate-500">문항·정답·해설·의도</small></span></Button></AlertDialogAction><AlertDialogAction asChild><Button variant="outline" onClick={() => printPdf("question-paper")} className="h-auto justify-start border-slate-200 bg-white py-3 text-left hover:bg-slate-50"><Printer className="mr-3 h-5 w-5 text-[#B56716]" /><span><strong className="block">시험지 PDF</strong><small className="text-slate-500">인쇄 창에서 PDF 저장</small></span></Button></AlertDialogAction><AlertDialogAction asChild><Button variant="outline" onClick={() => printPdf("answer-sheet")} className="h-auto justify-start border-slate-200 bg-white py-3 text-left hover:bg-slate-50"><Printer className="mr-3 h-5 w-5 text-[#7B56B3]" /><span><strong className="block">정답·해설 PDF</strong><small className="text-slate-500">인쇄 창에서 PDF 저장</small></span></Button></AlertDialogAction><AlertDialogAction asChild><Button variant="outline" onClick={downloadCsv} className="h-auto justify-start border-slate-200 bg-white py-3 text-left hover:bg-slate-50 sm:col-span-2"><FileSpreadsheet className="mr-3 h-5 w-5 text-[#15856B]" /><span><strong className="block">CSV 목록</strong><small className="text-slate-500">문항 은행 정리용 표 형식</small></span></Button></AlertDialogAction></div><AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
    <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["문항", "유형·난이도", "정답", "출제 의도", "생성 이력"].map(item => <th key={item} className="px-5 py-4 font-semibold">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{isLoading ? <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">승인 문항을 불러오는 중입니다.</td></tr> : questions?.length ? questions.map(item => <tr key={item.id} className="align-top"><td className="max-w-md px-5 py-4"><p className="line-clamp-3 font-medium leading-6 text-[#183248]">{item.questionText}</p><span className="mt-2 inline-block text-xs text-slate-400">문항 #{item.id} · {new Date(item.createdAt).toLocaleDateString("ko-KR")}</span></td><td className="px-5 py-4"><Badge variant="outline">{item.questionType}</Badge><p className="mt-2 text-xs text-slate-500">난이도 {item.difficulty} · {item.points}점</p></td><td className="px-5 py-4 font-semibold text-[#15856B]">{item.answer}</td><td className="max-w-xs px-5 py-4 leading-5 text-slate-600">{item.intent}</td><td className="px-5 py-4 text-xs text-slate-500"><p>{item.model}</p><p className="mt-1">{item.promptVersion}</p></td></tr>) : <tr><td colSpan={5} className="px-5 py-14 text-center"><FileDown className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-medium text-slate-600">승인된 문항이 없습니다.</p><p className="mt-1 text-sm text-slate-400">검수함에서 문항을 승인하면 이 목록에서 관리할 수 있습니다.</p></td></tr>}</tbody></table></div></section>
  </div>;
}
