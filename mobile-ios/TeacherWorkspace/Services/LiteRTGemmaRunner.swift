import Foundation
import LiteRTLM

/// LiteRT-LM Swift API를 통해 선택한 모델만 iPhone에서 실행한다. 대화·문항 내용은 자동 업로드하지 않는다.
@MainActor
final class LiteRTGemmaRunner: ObservableObject {
    enum Stage: Equatable { case idle, loading, ready, generating, failed(String) }
    @Published private(set) var stage: Stage = .idle
    @Published private(set) var preparedModelName = ""
    private var engine: Engine?

    func prepare(modelURL: URL, displayName: String, maxTokens: Int = 1024) async throws {
        stage = .loading
        do {
            let cacheDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!.path
            let configuration = try EngineConfig(modelPath: modelURL.path, backend: .gpu, maxNumTokens: maxTokens, cacheDir: cacheDirectory)
            let loadedEngine = Engine(engineConfig: configuration)
            try await loadedEngine.initialize()
            engine = loadedEngine
            preparedModelName = displayName
            stage = .ready
        } catch {
            stage = .failed(error.localizedDescription)
            throw error
        }
    }

    func send(systemMessage: String, prompt: String) async throws -> String {
        guard let engine else { throw LiteRTWorkspaceError.modelNotReady }
        stage = .generating
        defer { if case .generating = stage { stage = .ready } }
        let configuration = ConversationConfig(systemMessage: Message(systemMessage))
        let conversation = try await engine.createConversation(with: configuration)
        var response = ""
        for try await part in conversation.sendMessageStream(Message(prompt)) { response += part.toString }
        return response.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

enum LiteRTWorkspaceError: LocalizedError { case modelNotReady; case unstructuredQuiz
    var errorDescription: String? { switch self { case .modelNotReady: return "모델 관리에서 E2B 또는 E4B 파일을 준비한 뒤 다시 시도해 주세요."; case .unstructuredQuiz: return "문항을 분리하지 못했습니다. 다시 생성하거나 내용을 확인해 주세요." } }
}
