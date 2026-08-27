import SwiftUI
import UIKit

/// 학생용 공유는 교사가 개별 승인한 문항·보기만 운영체제 공유 시트로 전달한다.
struct StudentShareSheet: UIViewControllerRepresentable {
    let text: String
    let subject: String

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let sheet = UIActivityViewController(activityItems: [text], applicationActivities: nil)
        sheet.setValue(subject, forKey: "subject")
        return sheet
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
