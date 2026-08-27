import CryptoKit
import Foundation

struct ModelProfile: Identifiable, Equatable { let id: String; let title: String; let note: String
    static let e2b = ModelProfile(id: "gemma4-e2b", title: "Gemma 4 E2B", note: "기본값 · 일반적인 iPhone 사용에 권장")
    static let e4b = ModelProfile(id: "gemma4-e4b", title: "Gemma 4 E4B", note: "고성능 기기 전용 · 발열과 배터리를 확인하세요")
}

/// 모델은 사용자가 선택한 파일만 앱 전용 폴더에 복사하며, 모델 내용이나 문항을 외부에 올리지 않는다.
enum ModelFileStore {
    static func importModel(from sourceURL: URL, profile: ModelProfile) throws -> URL {
        guard sourceURL.startAccessingSecurityScopedResource() else { throw CocoaError(.fileReadNoPermission) }
        defer { sourceURL.stopAccessingSecurityScopedResource() }
        let folder = try modelFolder()
        let destination = folder.appendingPathComponent("\(profile.id).litertlm")
        try? FileManager.default.removeItem(at: destination)
        try FileManager.default.copyItem(at: sourceURL, to: destination)
        // 모델은 개인 자료와 함께 iCloud·기기 백업에 자동 복사하지 않고, 기기 잠금 뒤에만 접근한다.
        try? FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: destination.path)
        var protectedDestination = destination
        try? protectedDestination.setResourceValue(true, forKey: .isExcludedFromBackupKey)
        return destination
    }
    static func delete(profile: ModelProfile) throws { try? FileManager.default.removeItem(at: try modelURL(profile: profile)) }
    static func modelURL(profile: ModelProfile) throws -> URL { try modelFolder().appendingPathComponent("\(profile.id).litertlm") }
    static func hasModel(profile: ModelProfile) -> Bool { (try? modelURL(profile: profile)).map { FileManager.default.fileExists(atPath: $0.path) } ?? false }
    static func sha256(for profile: ModelProfile) throws -> String { let data = try Data(contentsOf: try modelURL(profile: profile)); return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
    private static func modelFolder() throws -> URL { let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!.appendingPathComponent("TeacherWorkspace/Models", isDirectory: true); try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true); return folder }
}
