import Foundation

/// 쪽지시험은 세트가 아니라 문항마다 교사가 최종 상태를 기록한다.
enum QuickQuizReviewStatus: String, Codable, CaseIterable, Identifiable {
    case pendingReview = "pending_review"
    case approved
    case revised
    case rejected

    var id: String { rawValue }
    var label: String {
        switch self {
        case .pendingReview: return "검수 대기"
        case .approved: return "승인"
        case .revised: return "수정 필요"
        case .rejected: return "반려"
        }
    }
}

struct QuickQuizQuestion: Codable, Identifiable, Equatable {
    var id: UUID = UUID()
    var questionText: String
    var choices: [String]
    var answer: String
    var explanation: String
    var concept: String
    /// 배점은 교사가 검수 후 정하며, nil은 아직 학생용 출력에 표기하지 않는다는 뜻이다.
    var points: Double? = nil
}

struct QuickQuizSet: Codable, Identifiable, Equatable {
    var id: UUID = UUID()
    var subject: String
    var unit: String
    var topic: String
    var schoolLevel: String
    var difficulty: String
    var questionFormat: String
    var createdAt: Date = .now
    var questions: [QuickQuizQuestion]
    var questionReviewStates: [QuickQuizReviewStatus]

    enum CodingKeys: String, CodingKey { case id, subject, unit, topic, schoolLevel, difficulty, questionFormat, createdAt, questions, questionReviewStates }

    init(subject: String, unit: String, topic: String, schoolLevel: String = "고등", difficulty: String = "보통", questionFormat: String, questions: [QuickQuizQuestion]) {
        self.subject = subject; self.unit = unit; self.topic = topic; self.schoolLevel = schoolLevel; self.difficulty = difficulty; self.questionFormat = questionFormat; self.questions = questions
        self.questionReviewStates = Array(repeating: .pendingReview, count: questions.count)
    }

    /// 이전 데이터에 상태 배열이 없거나 문항 수가 달라도 모든 누락 상태는 검수 대기로 읽는다.
    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        subject = try values.decode(String.self, forKey: .subject)
        unit = try values.decode(String.self, forKey: .unit)
        topic = try values.decode(String.self, forKey: .topic)
        schoolLevel = try values.decodeIfPresent(String.self, forKey: .schoolLevel) ?? "고등"
        difficulty = try values.decodeIfPresent(String.self, forKey: .difficulty) ?? "보통"
        questionFormat = try values.decodeIfPresent(String.self, forKey: .questionFormat) ?? "multiple_choice"
        createdAt = try values.decodeIfPresent(Date.self, forKey: .createdAt) ?? .now
        questions = try values.decode([QuickQuizQuestion].self, forKey: .questions)
        let saved = try values.decodeIfPresent([QuickQuizReviewStatus].self, forKey: .questionReviewStates) ?? []
        questionReviewStates = questions.indices.map { saved.indices.contains($0) ? saved[$0] : .pendingReview }
    }

    var pendingCount: Int { questionReviewStates.filter { $0 == .pendingReview }.count }
    var approvedCount: Int { questionReviewStates.filter { $0 == .approved }.count }
    var reviewedCount: Int { questionReviewStates.filter { $0 != .pendingReview }.count }
    var summaryStatus: QuickQuizReviewStatus {
        if pendingCount > 0 { return .pendingReview }
        if questionReviewStates.allSatisfy({ $0 == .approved }) { return .approved }
        if questionReviewStates.allSatisfy({ $0 == .rejected }) { return .rejected }
        return .revised
    }
}

struct AssessmentQuestion: Codable, Identifiable, Equatable {
    var id: UUID = UUID()
    var title: String
    var content: String
    var reviewStatus: QuickQuizReviewStatus = .pendingReview
    var createdAt: Date = .now
}

struct ApprovedQuickQuizItem: Identifiable {
    let set: QuickQuizSet
    let questionIndex: Int
    let question: QuickQuizQuestion
    var id: String { "\(set.id.uuidString)-\(questionIndex)" }
}

struct WorkspaceDashboardStats {
    let quickQuizSetCount: Int
    let quickQuizPendingCount: Int
    let quickQuizApprovedCount: Int
    let quickQuizReviewedCount: Int
    let regularPendingCount: Int
    let regularApprovedCount: Int
    var pendingCount: Int { regularPendingCount + quickQuizPendingCount }
    var approvedCount: Int { regularApprovedCount + quickQuizApprovedCount }
}
