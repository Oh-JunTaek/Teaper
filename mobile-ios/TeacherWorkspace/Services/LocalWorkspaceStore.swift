import Foundation

/// iOS 앱 전용 저장소다. 자료·문항·대화 원문을 서버나 다른 기기로 자동 동기화하지 않는다.
@MainActor
final class LocalWorkspaceStore: ObservableObject {
    @Published private(set) var quickQuizzes: [QuickQuizSet] = []
    @Published private(set) var assessmentQuestions: [AssessmentQuestion] = []

    private struct Snapshot: Codable { var quickQuizzes: [QuickQuizSet]; var assessmentQuestions: [AssessmentQuestion] }
    private let fileURL: URL

    init(fileManager: FileManager = .default) {
        let folder = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!.appendingPathComponent("TeacherWorkspace", isDirectory: true)
        try? fileManager.createDirectory(at: folder, withIntermediateDirectories: true)
        fileURL = folder.appendingPathComponent("workspace.json")
        // 문항·검수 기록은 기기 잠금 해제 뒤에만 읽고, OS 백업으로 자동 이전하지 않는다.
        protectLocalFile(fileURL)
        load()
    }

    func saveQuickQuiz(_ quiz: QuickQuizSet) {
        quickQuizzes.removeAll { $0.id == quiz.id }
        quickQuizzes.insert(quiz, at: 0)
        persist()
    }

    func updateQuickQuizReview(setID: UUID, questionIndex: Int, status: QuickQuizReviewStatus) {
        guard let setIndex = quickQuizzes.firstIndex(where: { $0.id == setID }), quickQuizzes[setIndex].questionReviewStates.indices.contains(questionIndex) else { return }
        quickQuizzes[setIndex].questionReviewStates[questionIndex] = status
        persist()
    }

    /// 배점은 해당 쪽지시험의 한 문항에만 저장하며, 비우면 학생용 문서에서 미표기 상태로 되돌린다.
    func updateQuickQuizPoints(setID: UUID, questionIndex: Int, points: Double?) {
        guard points == nil || points! >= 0, points == nil || points! <= 100, points == nil || (points! * 10).rounded() == points! * 10,
              let setIndex = quickQuizzes.firstIndex(where: { $0.id == setID }), quickQuizzes[setIndex].questions.indices.contains(questionIndex) else { return }
        quickQuizzes[setIndex].questions[questionIndex].points = points
        persist()
    }

    func deleteQuickQuiz(_ id: UUID) { quickQuizzes.removeAll { $0.id == id }; persist() }

    var dashboard: WorkspaceDashboardStats {
        let quickPending = quickQuizzes.reduce(0) { $0 + $1.pendingCount }
        let quickApproved = quickQuizzes.reduce(0) { $0 + $1.approvedCount }
        let quickReviewed = quickQuizzes.reduce(0) { $0 + $1.reviewedCount }
        return WorkspaceDashboardStats(quickQuizSetCount: quickQuizzes.count, quickQuizPendingCount: quickPending, quickQuizApprovedCount: quickApproved, quickQuizReviewedCount: quickReviewed, regularPendingCount: assessmentQuestions.filter { $0.reviewStatus == .pendingReview }.count, regularApprovedCount: assessmentQuestions.filter { $0.reviewStatus == .approved }.count)
    }

    var approvedQuickQuizItems: [ApprovedQuickQuizItem] {
        quickQuizzes.flatMap { set in set.questions.indices.compactMap { index in set.questionReviewStates[safe: index] == .approved ? ApprovedQuickQuizItem(set: set, questionIndex: index, question: set.questions[index]) : nil } }
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL), let snapshot = try? JSONDecoder.workspace.decode(Snapshot.self, from: data) else { return }
        quickQuizzes = snapshot.quickQuizzes.sorted { $0.createdAt > $1.createdAt }
        assessmentQuestions = snapshot.assessmentQuestions.sorted { $0.createdAt > $1.createdAt }
    }

    private func persist() {
        let snapshot = Snapshot(quickQuizzes: quickQuizzes, assessmentQuestions: assessmentQuestions)
        guard let data = try? JSONEncoder.workspace.encode(snapshot) else { return }
        try? data.write(to: fileURL, options: .atomic)
        protectLocalFile(fileURL)
    }

    private func protectLocalFile(_ url: URL) {
        guard FileManager.default.fileExists(atPath: url.path) else { return }
        try? FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: url.path)
        var mutableURL = url
        try? mutableURL.setResourceValue(true, forKey: .isExcludedFromBackupKey)
    }
}

private extension Array {
    subscript(safe index: Index) -> Element? { indices.contains(index) ? self[index] : nil }
}

private extension JSONEncoder { static let workspace: JSONEncoder = { let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601; return encoder }() }
private extension JSONDecoder { static let workspace: JSONDecoder = { let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601; return decoder }() }
