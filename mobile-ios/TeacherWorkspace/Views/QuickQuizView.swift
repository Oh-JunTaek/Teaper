import SwiftUI
import UIKit

struct QuickQuizView: View {
    @EnvironmentObject private var workspace: LocalWorkspaceStore
    @EnvironmentObject private var runner: LiteRTGemmaRunner
    @State private var topic = ""
    @State private var format = "multiple_choice"
    @State private var questionCount = 1
    @State private var isGenerating = false
    @State private var message = ""
    @State private var selectedQuiz: QuickQuizSet?

    var body: some View { NavigationStack { List {
        Section("새 쪽지시험") {
            TextField("확인할 개념 (예: 분자 구조)", text: $topic)
            Picker("문항 형식", selection: $format) { Text("객관식").tag("multiple_choice"); Text("주관식").tag("short_answer"); Text("O/X").tag("ox") }
            Stepper("문항 수 \(questionCount)", value: $questionCount, in: 1...5)
            Button(isGenerating ? "문항 생성 중" : "간결한 쪽지시험 만들기") { Task { await generate() } }.disabled(isGenerating || topic.trimmingCharacters(in: .whitespaces).isEmpty)
            if !message.isEmpty { Text(message).font(.footnote).foregroundStyle(.secondary) }
        }
        let stats = workspace.dashboard
        Section("검수 현황") { Label("검수 대기 \(stats.quickQuizPendingCount)문항", systemImage: "clock").foregroundStyle(.orange); Label("승인 \(stats.quickQuizApprovedCount)문항", systemImage: "checkmark.circle").foregroundStyle(.green) }
        Section("저장한 쪽지시험") { ForEach(workspace.quickQuizzes) { quiz in Button { selectedQuiz = quiz } label: { VStack(alignment: .leading, spacing: 5) { Text(quiz.topic).font(.headline); Text("\(quiz.subject) · \(quiz.unit) · \(quiz.questions.count)문항").font(.caption).foregroundStyle(.secondary); Text("\(quiz.summaryStatus.label) · 검수 대기 \(quiz.pendingCount) · 승인 \(quiz.approvedCount)").font(.caption).foregroundStyle(quiz.pendingCount > 0 ? .orange : .secondary) } }.swipeActions { Button(role: .destructive) { workspace.deleteQuickQuiz(quiz.id) } label: { Label("삭제", systemImage: "trash") } } } }
    }.navigationTitle("간결한 쪽지시험").sheet(item: $selectedQuiz) { quiz in QuickQuizDetailView(quizID: quiz.id) } }

    private func generate() async { isGenerating = true; defer { isGenerating = false }
        do { let quiz = try await QuickQuizGenerator.generate(runner: runner, subject: "화학 I", unit: "공통", topic: topic, format: format, count: questionCount); workspace.saveQuickQuiz(quiz); message = "검수 대기 쪽지시험을 저장했습니다. 문항별로 확인해 주세요."; selectedQuiz = quiz } catch { message = error.localizedDescription }
    }
}

struct QuickQuizDetailView: View {
    @EnvironmentObject private var workspace: LocalWorkspaceStore
    let quizID: UUID
    @Environment(\.dismiss) private var dismiss
    @State private var isStudentShareOpen = false
    @State private var isStudentPDFShareOpen = false
    @State private var includePointsWhenSharing = false
    @State private var studentPDFURL: URL?
    private var quiz: QuickQuizSet? { workspace.quickQuizzes.first { $0.id == quizID } }
    var body: some View { NavigationStack { Group { if let quiz { List { Section("\(quiz.topic) · \(quiz.summaryStatus.label)") { Text("승인 문항만 학생용으로 공유되며, 정답·해설은 포함하지 않습니다.").font(.footnote).foregroundStyle(.secondary); if OutputPlanPolicy.shouldShowStudentWatermark { Text("학생용 PDF 오른쪽 아래 여백에 EunmaStudio 표기가 들어갑니다.").font(.footnote).foregroundStyle(.secondary) } }
        ForEach(quiz.questions.indices, id: \.self) { index in let question = quiz.questions[index]; Section("\(index + 1)번 · \(quiz.questionReviewStates[index].label)") { Text(question.questionText).font(.headline); ForEach(question.choices, id: \.self) { Text($0) }; HStack { Text("배점"); TextField("0~100", value: Binding(get: { question.points ?? 0 }, set: { workspace.updateQuickQuizPoints(setID: quiz.id, questionIndex: index, points: $0) }), format: .number.precision(.fractionLength(0...1))).keyboardType(.decimalPad).multilineTextAlignment(.trailing); Text("점") }; HStack { ForEach([2.0, 3.0, 4.0], id: \.self) { points in Button("\(Int(points))점") { workspace.updateQuickQuizPoints(setID: quiz.id, questionIndex: index, points: points) }.buttonStyle(.bordered) } }; Text("정답: \(question.answer)").font(.subheadline.bold()); Text("해설: \(question.explanation)").font(.footnote); Picker("검수 결과", selection: Binding(get: { quiz.questionReviewStates[index] }, set: { workspace.updateQuickQuizReview(setID: quiz.id, questionIndex: index, status: $0) })) { ForEach(QuickQuizReviewStatus.allCases) { Text($0.label).tag($0) } }.pickerStyle(.menu) } }
    } } else { VStack(spacing: 12) { Image(systemName: "exclamationmark.triangle").font(.largeTitle).foregroundStyle(.orange); Text("쪽지시험을 찾지 못했습니다.").foregroundStyle(.secondary) }.frame(maxWidth: .infinity, maxHeight: .infinity) } }.navigationTitle("문항별 검수").toolbar { ToolbarItem(placement: .topBarTrailing) { if let quiz, studentShareText(for: quiz) != nil { Menu("학생용 출력") { Toggle("PDF·텍스트에 배점 표기", isOn: $includePointsWhenSharing); Button("텍스트 공유") { isStudentShareOpen = true }; Button("PDF 공유") { studentPDFURL = makeStudentPDF(for: quiz); isStudentPDFShareOpen = studentPDFURL != nil } } }; Button("닫기") { dismiss() } } }.sheet(isPresented: $isStudentShareOpen) { if let quiz, let text = studentShareText(for: quiz) { StudentShareSheet(text: text, subject: "\(quiz.subject) · \(quiz.topic) 쪽지시험") } }.sheet(isPresented: $isStudentPDFShareOpen) { if let studentPDFURL { StudentPDFShareSheet(fileURL: studentPDFURL, subject: "\(quiz.subject) · \(quiz.topic) 쪽지시험") } } } }

    private func studentShareText(for quiz: QuickQuizSet) -> String? {
        let questions = quiz.questions.indices.compactMap { index -> String? in
            guard quiz.questionReviewStates[index] == .approved else { return nil }
            let question = quiz.questions[index]
            let points = includePointsWhenSharing ? question.points.map { " ［\($0)점］" } ?? "" : ""
            return "\(index + 1)번\n\(question.questionText)\(points)\n\(question.choices.joined(separator: "\n"))".trimmingCharacters(in: .whitespacesAndNewlines)
        }
        guard !questions.isEmpty else { return nil }
        return "\(quiz.subject) · \(quiz.unit)\n\(quiz.topic)\n\n\(questions.joined(separator: "\n\n"))"
    }

    /// 승인 문항·보기만 PDF에 그리고, 선택하지 않은 난이도·정답·해설·개념은 출력하지 않는다.
    private func makeStudentPDF(for quiz: QuickQuizSet) -> URL? {
        guard let text = studentShareText(for: quiz) else { return nil }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("승인-쪽지시험-학생용.pdf")
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 595, height: 842))
        do { try renderer.writePDF(to: url) { context in
            let margin: CGFloat = 48; let width: CGFloat = 499; var y: CGFloat = margin
            let attributes: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 12), .foregroundColor: UIColor.black]
            context.beginPage()
            text.components(separatedBy: .newlines).forEach { line in
                let lines = line.isEmpty ? [""] : splitPDFLine(line, width: width, attributes: attributes)
                lines.forEach { value in
                    if y > 794 { drawWatermark(in: context, enabled: OutputPlanPolicy.shouldShowStudentWatermark); context.beginPage(); y = margin }
                    value.draw(at: CGPoint(x: margin, y: y), withAttributes: attributes); y += 20
                }
            }
            drawWatermark(in: context, enabled: OutputPlanPolicy.shouldShowStudentWatermark)
        }; return url } catch { return nil }
    }

    private func splitPDFLine(_ text: String, width: CGFloat, attributes: [NSAttributedString.Key: Any]) -> [String] {
        var result: [String] = []; var remaining = text
        while !remaining.isEmpty { var end = remaining.count; while end > 1 && (remaining as NSString).substring(to: end).size(withAttributes: attributes).width > width { end -= 1 }; result.append((remaining as NSString).substring(to: end)); remaining = (remaining as NSString).substring(from: end) }
        return result
    }

    /// 기본 플랜 학생용 PDF의 오른쪽 아래 여백만 사용해 문항·배점·답안 공간을 침범하지 않는다.
    private func drawWatermark(in context: UIGraphicsPDFRendererContext, enabled: Bool) {
        guard enabled else { return }
        let attributes: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 8), .foregroundColor: UIColor.systemGray]
        let text = "EunmaStudio" as NSString
        let size = text.size(withAttributes: attributes)
        text.draw(at: CGPoint(x: 595 - 48 - size.width, y: 842 - 24), withAttributes: attributes)
    }
}

/// PDF 파일은 앱 임시 보관함에만 두고, 운영체제 공유 시트가 선택한 대상에 읽기 권한을 잠시 전달한다.
private struct StudentPDFShareSheet: UIViewControllerRepresentable {
    let fileURL: URL; let subject: String
    func makeUIViewController(context: Context) -> UIActivityViewController { let controller = UIActivityViewController(activityItems: [fileURL], applicationActivities: nil); controller.setValue(subject, forKey: "subject"); return controller }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
