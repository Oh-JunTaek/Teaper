# iOS/App Store 확장 검토 기록

작성일: 2026-08-27  
작성자: EunmaStudio 개발 기록

## 결론

**iOS 버전은 구현할 수 있습니다.** 현재 Android 앱의 Kotlin 코드를 변환하는 방식이 아니라, `SwiftUI + LiteRT-LM Swift API`로 작성하는 별도의 iOS 앱이 필요합니다. 쪽지시험·일반 문항·자료·메모·일정·대화는 iPhone 내부 저장소에 보관하고, 자료·문항·대화 원문을 자동 업로드하지 않는 local-only 원칙을 유지합니다.

LiteRT-LM은 iOS용 네이티브 Swift API, Metal GPU 가속, 이미지 입력을 지원하며 Gemma 4 같은 다중 입력 모델을 안내합니다.[1] 공식 패키지 정의는 iOS 15 이상과 `LiteRTLM` 라이브러리 제품을 명시합니다.[2] 다만 Google의 플랫폼 안내에서 Swift API는 **Early Preview**로 분류되어 있으므로, Android와 똑같은 성능·안정성을 사전에 약속하지 않고 iPhone 실기기 성능 검증을 거쳐야 합니다.[3]

| 영역 | iOS 구현 방향 | 출시 전 확인 |
|---|---|---|
| 앱 화면 | SwiftUI로 교사도우미의 자료·문항·검수·쪽지시험·메모·일정·승인 보관함을 구현 | iPhone 작은 화면, Dynamic Type, VoiceOver |
| 온디바이스 AI | LiteRT-LM Swift Package와 Metal GPU 사용, E2B 기본·E4B 선택 안내 | 기기별 발열·저장공간·메모리·응답 안정성 |
| 모델 파일 | 앱 전용 저장소로 내려받고 해시 확인·재시도·삭제 제공 | 대용량 다운로드, Wi-Fi 안내, 저전력 모드 |
| 자료·문항 | iOS Application Support에 암호화 가능 구조로 저장, 자동 외부 동기화 없음 | 파일 선택, 공유 시트, 앱 삭제·재설치 동작 |
| 문서 공유 | 학생용은 승인 문항만·정답/해설 제외, 교사용은 별도 출력 | Files·AirPrint·공유 대상별 출력 |
| 배포 | TestFlight 검증 뒤 App Store Connect 제출 | 심사용 계정/데모, 개인정보 처리방침, Support URL, 정확한 앱 정보 |

## 구현 순서

1. iOS 전용 `mobile-ios` 기반을 만들고, local-only 저장소와 승인·쪽지시험 문항 상태 계약을 Android와 맞춥니다.
2. LiteRT-LM Swift 모델 준비·대화·문항 생성의 최소 흐름을 iPhone 실기기에 연결합니다.
3. 자료 불러오기, 승인 문항 보관함, 학생용/교사용 문서 공유, 앱 잠금을 차례로 구현합니다.
4. TestFlight에서 실제 교사가 안정성을 확인한 뒤, App Store Connect의 앱 개인정보 정보와 심사 자료를 준비합니다.

> App Store 제출본은 기능이 완성되어야 하며, 로그인 기능이 있으면 심사자가 사용할 수 있는 계정 또는 완전한 데모 모드와 설명을 제공해야 합니다.[4] 개인정보 처리방침 URL은 모든 앱에 요구됩니다.[5] 따라서 현재 Android 파일럿처럼 설치만 가능한 수준의 앱을 바로 공개 스토어에 올리지 않고 TestFlight부터 진행하는 것이 안전합니다.

## 현재 보류 사항

현재 Linux 개발 환경에서는 Xcode·iOS Simulator·서명·TestFlight 업로드를 실행할 수 없습니다. iOS 소스 구조와 테스트 계획은 준비할 수 있지만, 실제 IPA 생성과 App Store 제출에는 Apple Developer Program에 연결된 macOS/Xcode와 배포 권한이 필요합니다. 이 제약은 기능 구현 미완료를 숨기지 않기 위한 운영 기록입니다.

## 참고 자료

[1] [LiteRT-LM Swift API — Google AI Edge](https://developers.google.com/edge/litert-lm/swift)  
[2] [LiteRT-LM 공식 Swift Package 정의 — Google AI Edge GitHub](https://github.com/google-ai-edge/LiteRT-LM/blob/main/Package.swift)  
[3] [LiteRT-LM Overview — Google AI Edge](https://developers.google.com/edge/litert-lm/overview)  
[4] [App Review Guidelines, 2.1 App Completeness — Apple Developer](https://developer.apple.com/app-store/review/guidelines/)  
[5] [Manage app privacy — App Store Connect Help](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
