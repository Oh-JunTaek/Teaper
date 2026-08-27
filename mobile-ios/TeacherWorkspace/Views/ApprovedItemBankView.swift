import SwiftUI

struct ApprovedItemBankView: View {
    @EnvironmentObject private var workspace: LocalWorkspaceStore
    @State private var search = ""
    var body: some View { NavigationStack { List { let regular = workspace.assessmentQuestions.filter { $0.reviewStatus == .approved && matches($0.title + " " + $0.content) }; let quick = workspace.approvedQuickQuizItems.filter { matches($0.question.questionText + " " + $0.set.topic) }
        Section("승인 문항 보관함") { Text("일반 문항과 쪽지시험에서 개별 승인한 문항을 함께 관리합니다. 학생용 공유에는 승인 문항만 넣으세요.").font(.footnote).foregroundStyle(.secondary) }
        if !regular.isEmpty { Section("일반 문항 \(regular.count)개") { ForEach(regular) { Text($0.title) } } }
        if !quick.isEmpty { Section("승인 쪽지시험 문항 \(quick.count)개") { ForEach(quick) { item in VStack(alignment: .leading, spacing: 5) { Label("쪽지시험 · \(item.set.topic) · \(item.questionIndex + 1)번", systemImage: "timer").font(.caption).foregroundStyle(.orange); Text(item.question.questionText).font(.body); Text("\(item.set.subject) · \(item.set.unit)").font(.caption).foregroundStyle(.secondary) } } }
        if regular.isEmpty && quick.isEmpty { VStack(spacing: 10) { Image(systemName: "checkmark.seal").font(.largeTitle).foregroundStyle(.green); Text("승인 문항이 없습니다.").font(.headline); Text("일반 문항 또는 쪽지시험에서 교사가 문항을 승인하면 이곳에 모입니다.").font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center) }.frame(maxWidth: .infinity).padding(.vertical, 36).listRowBackground(Color.clear) }
    }.searchable(text: $search, prompt: "문항·단원·개념 검색").navigationTitle("승인 문항") } }
    private func matches(_ value: String) -> Bool { search.isEmpty || value.localizedCaseInsensitiveContains(search) }
}
