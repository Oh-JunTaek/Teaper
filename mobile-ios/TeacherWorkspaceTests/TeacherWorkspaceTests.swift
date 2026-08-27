import XCTest
@testable import TeacherWorkspace

final class TeacherWorkspaceTests: XCTestCase {
    func testLegacyQuickQuizDefaultsEveryQuestionToPendingReview() throws {
        let data = """{"subject":"화학 I","unit":"공통","topic":"분자","questions":[{"questionText":"분자는?","choices":[],"answer":"O2","explanation":"설명","concept":"분자"}]}""".data(using: .utf8)!
        let quiz = try JSONDecoder().decode(QuickQuizSet.self, from: data)
        XCTAssertEqual(quiz.pendingCount, 1)
        XCTAssertEqual(quiz.summaryStatus, .pendingReview)
    }

    func testApprovalCountsUseIndividualQuestionsNotSetStatus() {
        var quiz = QuickQuizSet(subject: "화학 I", unit: "공통", topic: "분자", questionFormat: "multiple_choice", questions: [QuickQuizQuestion(questionText: "A", choices: [], answer: "A", explanation: "", concept: ""), QuickQuizQuestion(questionText: "B", choices: [], answer: "B", explanation: "", concept: "")])
        quiz.questionReviewStates = [.approved, .rejected]
        XCTAssertEqual(quiz.approvedCount, 1)
        XCTAssertEqual(quiz.summaryStatus, .revised)
    }
}
