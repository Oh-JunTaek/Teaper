import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            DashboardView().tabItem { Label("오늘의 작업", systemImage: "rectangle.grid.2x2") }
            QuickQuizView().tabItem { Label("쪽지시험", systemImage: "timer") }
            ApprovedItemBankView().tabItem { Label("승인 문항", systemImage: "checkmark.seal") }
            ModelManagerView().tabItem { Label("AI 도움 기능", systemImage: "cpu") }
        }
        .tint(.green)
    }
}

struct DashboardView: View {
    @EnvironmentObject private var workspace: LocalWorkspaceStore
    var body: some View {
        let stats = workspace.dashboard
        NavigationStack { ScrollView { VStack(alignment: .leading, spacing: 18) {
            Text("오늘의 출제 업무").font(.largeTitle.bold())
            Text("자료를 준비하고 문항을 만든 뒤, 교사가 최종 검수합니다.").foregroundStyle(.secondary)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                DashboardCard(value: stats.pendingCount, title: "검수 대기 문항", detail: "쪽지시험 \(stats.quickQuizPendingCount)문항 포함", color: .orange)
                DashboardCard(value: stats.approvedCount, title: "승인된 문항", detail: "쪽지시험 \(stats.quickQuizApprovedCount)문항 포함", color: .green)
            }
            GroupBox("간결한 쪽지시험") { VStack(alignment: .leading, spacing: 7) { Text("현재 \(stats.quickQuizSetCount)개 세트 · 검수 완료 \(stats.quickQuizReviewedCount)문항").font(.subheadline); Text("세트 안의 문항마다 승인·수정 필요·반려를 따로 기록합니다.").font(.footnote).foregroundStyle(.secondary) } }
            Text("자료·문항·대화는 이 기기에만 저장되며 자동 동기화하지 않습니다.").font(.footnote).foregroundStyle(.secondary)
        }.padding() }.navigationTitle("교사도우미") }
    }
}

private struct DashboardCard: View { let value: Int; let title: String; let detail: String; let color: Color
    var body: some View { VStack(alignment: .leading, spacing: 8) { Text("\(value)").font(.system(size: 34, weight: .bold)).foregroundStyle(color); Text(title).font(.headline); Text(detail).font(.caption).foregroundStyle(.secondary) }.frame(maxWidth: .infinity, alignment: .leading).padding().background(color.opacity(0.10), in: RoundedRectangle(cornerRadius: 18)) }
}
