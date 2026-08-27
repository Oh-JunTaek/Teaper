import Foundation

/// 학생용 PDF의 플랜 표시는 서명된 앱의 Info.plist 값만 기준으로 한다.
/// 기본 빌드는 워터마크를 표시하며, 결제 연결 전에는 배포 단계에서만 plus 값을 부여한다.
enum OutputPlanPolicy {
    static var isPlus: Bool {
        (Bundle.main.object(forInfoDictionaryKey: "EunmaOutputPlan") as? String)?.lowercased() == "plus"
    }

    static var shouldShowStudentWatermark: Bool { !isPlus }
}
