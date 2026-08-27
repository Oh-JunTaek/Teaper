# 교사도우미 iOS local-only 기반

이 폴더는 Android 앱을 단순 변환한 것이 아니라, iPhone·iPad용 **SwiftUI 네이티브 기반**입니다. 자료·문항·대화는 `Application Support/TeacherWorkspace`에 저장하며 자동 외부 동기화를 하지 않습니다.

## 포함된 첫 기반

- 쪽지시험 문항별 `검수 대기·승인·수정 필요·반려` 상태와 기존 상태 없는 세트의 안전한 호환
- 대시보드의 일반 문항·쪽지시험 합산 검수 대기/승인 수, 쪽지시험 관리, 승인 문항 보관함
- LiteRT-LM Swift API를 통한 E2B 기본·E4B 선택 모델 파일 가져오기, 앱 전용 저장, Metal GPU 준비, 온디바이스 대화·쪽지시험 생성 구조
- 학생 전달: 개별 승인 문항만 iOS 공유 시트로 보내며, 정답·해설은 전달하지 않음

## macOS에서 열기

1. macOS의 Xcode 16 이상에서 `TeacherWorkspace.xcodeproj`를 엽니다.
2. Xcode의 **File → Add Package Dependencies**에서 `https://github.com/google-ai-edge/LiteRT-LM`을 추가하고 `LiteRTLM` 제품이 TeacherWorkspace 타깃에 연결되었는지 확인합니다.
3. Apple Developer Team, 고유 Bundle Identifier, 서명 인증서를 선택합니다.
4. iOS 16 이상 iPhone·iPad 실기기에서 빌드합니다. E2B/E4B는 라이선스·출처·해시를 확인한 `.litertlm` 파일만 모델 관리 화면에서 가져옵니다.
5. TestFlight 검증이 완료된 뒤에만 App Store Connect 메타데이터·개인정보 처리방침·Support URL·심사 안내를 준비합니다.

> LiteRT-LM Swift API는 공식 문서상 Early Preview입니다. 앱을 공개하기 전에 E2B/E4B의 발열, 메모리, 모델 파일 준비, 문항별 검수, 학생용 공유를 실제 iPhone에서 반드시 확인해야 합니다.

자세한 제약과 출처는 [`../docs/ios-app-store-feasibility-2026-08.md`](../docs/ios-app-store-feasibility-2026-08.md)를 참조하세요.
