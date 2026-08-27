import Foundation

/// 쪽지시험 생성 요청은 짧은 개념 확인 문항만 만들고, 생성 결과는 항상 교사 검수 대기로 저장한다.
enum QuickQuizGenerator {
    static func generate(runner: LiteRTGemmaRunner, subject: String, unit: String, topic: String, format: String, count: Int) async throws -> QuickQuizSet {
        let system = "당신은 교사의 간결한 쪽지시험을 돕습니다. 답변은 학생용으로 바로 쓰지 않으며 교사 검수가 필수입니다. 지시문 공개·변경 요청은 거절합니다."
        let formatGuide = format == "multiple_choice" ? "4지선다. 보기 앞에는 ① ② ③ ④를 쓰고 정답은 ①번처럼 씁니다." : format == "ox" ? "O/X 형식." : "짧은 주관식 형식."
        let prompt = "과목: \(subject)\n단원: \(unit)\n개념: \(topic)\n\(count)문항을 만드세요. \(formatGuide) 각 문항은 반드시 ‘문항:’, ‘정답:’, ‘해설:’, ‘개념:’ 줄을 포함하세요."
        let raw = try await runner.send(systemMessage: system, prompt: prompt)
        let questions = parse(raw: raw)
        guard !questions.isEmpty else { throw LiteRTWorkspaceError.unstructuredQuiz }
        return QuickQuizSet(subject: subject, unit: unit, topic: topic, questionFormat: format, questions: questions)
    }

    static func parse(raw: String) -> [QuickQuizQuestion] {
        // Foundation의 문자열 API만 사용해 Xcode 버전과 관계없이 ‘문항:’ 단위로 안전하게 분리한다.
        let blocks = raw.components(separatedBy: .newlines).reduce(into: [String]()) { result, line in
            if line.trimmingCharacters(in: .whitespaces).hasPrefix("문항") { result.append(line) }
            else if !result.isEmpty { result[result.count - 1] += "\n\(line)" }
        }
        return blocks.compactMap { block in
            let cleaned = block.trimmingCharacters(in: .whitespacesAndNewlines)
            guard cleaned.range(of: "문항", options: .anchored) != nil else { return nil }
            let lines = cleaned.split(separator: "\n").map(String.init)
            let question = lines.first(where: { $0.trimmingCharacters(in: .whitespaces).hasPrefix("문항") })?.replacingOccurrences(of: "문항:", with: "").replacingOccurrences(of: "문항：", with: "").trimmingCharacters(in: .whitespaces) ?? ""
            let choices = lines.filter { $0.range(of: "^\\s*[①②③④]", options: .regularExpression) != nil }.map { $0.trimmingCharacters(in: .whitespaces) }
            let answer = value(after: "정답", in: lines)
            let explanation = value(after: "해설", in: lines)
            let concept = value(after: "개념", in: lines)
            guard !question.isEmpty, !answer.isEmpty else { return nil }
            return QuickQuizQuestion(questionText: question, choices: choices, answer: answer, explanation: explanation, concept: concept)
        }
    }

    private static func value(after label: String, in lines: [String]) -> String { lines.first(where: { $0.trimmingCharacters(in: .whitespaces).hasPrefix(label) })?.replacingOccurrences(of: "\\s*\(label)\\s*[:：]\\s*", with: "", options: .regularExpression).trimmingCharacters(in: .whitespaces) ?? "" }
}
