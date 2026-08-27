import SwiftUI
import UniformTypeIdentifiers

struct ModelManagerView: View {
    @EnvironmentObject private var runner: LiteRTGemmaRunner
    @State private var importProfile: ModelProfile?
    @State private var message = "E2B를 기본으로 권장합니다. 모델 파일은 이 iPhone에만 저장됩니다."
    private let profiles = [ModelProfile.e2b, .e4b]
    var body: some View { NavigationStack { List { Section("AI 도움 기능") { Text(message).font(.footnote).foregroundStyle(.secondary); if !runner.preparedModelName.isEmpty { Label("준비됨: \(runner.preparedModelName)", systemImage: "checkmark.circle.fill").foregroundStyle(.green) } }
        ForEach(profiles) { profile in Section(profile.title) { Text(profile.note).font(.subheadline); Text(ModelFileStore.hasModel(profile: profile) ? "이 iPhone에 파일이 준비되어 있습니다." : "아직 모델 파일이 없습니다.").font(.caption).foregroundStyle(.secondary); Button("모델 파일 가져오기") { importProfile = profile }; if ModelFileStore.hasModel(profile: profile) { Button("이 모델 준비") { Task { await prepare(profile) } }; Button("이 모델 삭제", role: .destructive) { try? ModelFileStore.delete(profile: profile); message = "\(profile.title) 파일을 이 iPhone에서 삭제했습니다." } } } }
    }.navigationTitle("모델 관리").fileImporter(isPresented: Binding(get: { importProfile != nil }, set: { if !$0 { importProfile = nil } }), allowedContentTypes: [.data]) { result in guard let profile = importProfile else { return }; switch result { case .success(let url): do { _ = try ModelFileStore.importModel(from: url, profile: profile); message = "\(profile.title) 파일을 앱 전용 저장소에 준비했습니다. ‘이 모델 준비’를 눌러 확인하세요." } catch { message = error.localizedDescription }; case .failure(let error): message = error.localizedDescription }; importProfile = nil } } }
    private func prepare(_ profile: ModelProfile) async { do { try await runner.prepare(modelURL: try ModelFileStore.modelURL(profile: profile), displayName: profile.title); message = "\(profile.title)을 이 iPhone에서 준비했습니다." } catch { message = error.localizedDescription } }
}
