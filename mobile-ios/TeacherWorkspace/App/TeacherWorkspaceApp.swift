import SwiftUI

@main
struct TeacherWorkspaceApp: App {
    @StateObject private var workspace = LocalWorkspaceStore()
    @StateObject private var aiRunner = LiteRTGemmaRunner()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(workspace)
                .environmentObject(aiRunner)
        }
    }
}
