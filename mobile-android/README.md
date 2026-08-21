# EunmaStudio Android 온디바이스 AI 파일럿

이 폴더는 **Gemma 4 E2B·E4B만** 제공하는 Android 네이티브 파일럿이다. AI Edge Gallery의 모델 저장소를 재사용하지 않으며, LiteRT Community의 `.litertlm` 모델을 앱 전용 저장소에 직접 내려받아 SHA-256으로 검증한다.

| 모델 | 기본 정책 | 파일 크기 | 앱의 설치 기준 |
|---|---|---:|---|
| Gemma 4 E2B | 기본값 | 2,588,147,712 bytes | 가용 저장 공간 5GB 이상 |
| Gemma 4 E4B | 고성능 기기 선택 | 3,659,530,240 bytes | 가용 저장 공간 7GB 이상, 총 메모리 8GB 이상, 심한 발열·절전 상태 아님 |

이 기준은 서비스의 파일럿 안전장치이며 Google의 일반 최소 사양이 아니다. 실제 Android 기기 시험 결과로 조정한다. E4B는 더 높은 품질을 보장하지 않으며, 시험 문항 생성·정답·해설은 교사 검수가 필요하다.

## 개발·빌드 전 확인

1. Android Studio 최신 안정판과 Android SDK 36을 설치한다.
2. `./gradlew :app:assembleDebug`로 개발 APK를 만든다.
3. 실제 기기에서 E2B 다운로드, 해시 검증, CPU/GPU fallback, 오프라인 응답, 삭제·재설치를 확인한다.
4. E4B는 고성능 기기에서만 발열·배터리·메모리 측정을 포함해 별도로 검증한다.

LiteRT-LM 의존성은 Android 컴파일로 검증한 `0.16.1`로 고정한다. 업데이트는 별도 기기 회귀 검증 후에만 반영한다. Google Play 비공개 테스트 전에는 `com.eunmastudio.teacherworkspace` 앱 ID의 Play App Signing·Data safety·개인정보 처리방침을 준비한다.

## 현재 범위와 다음 연결

현재 구현 범위는 모델 기기 진단, E2B/E4B 다운로드·해시 검증·앱 전용 저장·LiteRT-LM 실행, 자료·기출·공식 자료의 로컬 메모, 문항 생성·검수, 승인 문항의 DOCX·인쇄용 PDF 공유다. 원본 PDF·이미지의 내용 추출·페이지 근거와 실제 기기 성능 측정은 다음 단계에서 검증한다.
