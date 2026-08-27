import SwiftUI

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
            Picker("문항 형식", selection: $format) { Text("객관식 4지선다").tag("multiple_choice"); Text("주관식").tag("short_answer"); Text("O/X").tag("ox") }
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
    private var quiz: QuickQuizSet? { workspace.quickQuizzes.first { $0.id == quizID } }
    var body: some View { NavigationStack { Group { if let quiz { List { Section("\(quiz.topic) · \(quiz.summaryStatus.label)") { Text("승인 문항만 학생용으로 공유되며, 정답·해설은 포함하지 않습니다.").font(.footnote).foregroundStyle(.secondary) }
        ForEach(quiz.questions.indices, id: \.self) { index in let question = quiz.questions[index]; Section("\(index + 1)번 · \(quiz.questionReviewStates[index].label)") { Text(question.questionText).font(.headline); ForEach(question.choices, id: \.self) { Text($0) }; Text("정답: \(question.answer)").font(.subheadline.bold()); Text("해설: \(question.explanation)").font(.footnote); Picker("검수 결과", selection: Binding(get: { quiz.questionReviewStates[index] }, set: { workspace.updateQuickQuizReview(setID: quiz.id, questionIndex: index, status: $0) })) { ForEach(QuickQuizReviewStatus.allCases) { Text($0.label).tag($0) } }.pickerStyle(.menu) } }
    } } else { VStack(spacing: 12) { Image(systemName: "exclamationmark.triangle").font(.largeTitle).foregroundStyle(.orange); Text("쪽지시험을 찾지 못했습니다.").foregroundStyle(.secondary) }.frame(maxWidth: .infinity, maxHeight: .infinity) } }.navigationTitle("문항별 검수").toolbar { ToolbarItem(placement: .topBarTrailing) { if let quiz, studentShareText(for: quiz) != nil { Button("학생용 공유") { isStudentShareOpen = true } }; Button("닫기") { dismiss() } } }.sheet(isPresented: $isStudentShareOpen) { if let quiz, let text = studentShareText(for: quiz) { StudentShareSheet(text: text, subject: "\(quiz.subject) · \(quiz.topic) 쪽지시험") } } } }

    private func studentShareText(for quiz: QuickQuizSet) -> String? {
        let questions = quiz.questions.indices.compactMap { index -> String? in
            guard quiz.questionReviewStates[index] == .approved else { return nil }
            let question = quiz.questions[index]
            return "\(index + 1)번\n\(question.questionText)\n\(question.choices.joined(separator: "\n"))".trimmingCharacters(in: .whitespacesAndNewlines)
        }
        guard !questions.isEmpty else { return nil }
        return "\(quiz.subject) · \(quiz.unit)\n\(quiz.topic)\n\n\(questions.joined(separator: "\n\n"))"
    }
}
