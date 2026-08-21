# Google Play 출시 요건 조사 메모

## 공식 확인 결과

| 항목 | 2026-08 기준 공식 요건 | EunmaStudio Android 파일럿에 대한 의미 |
|---|---|---|
| Target API | 2026-08-31부터 신규 앱·업데이트는 Android 16, API 36 이상을 대상으로 제출해야 한다. | 현재 `targetSdk = 36`은 기준에 부합한다. [1] |
| 개인 개발자 계정 테스트 | 2023-11-13 이후 생성된 개인 Play Console 계정은 프로덕션 접근 전 최소 12명의 테스터가 14일 연속 참여한 비공개 테스트를 해야 한다. | 개인 계정이면 소수의 내부 테스트만으로 공개 배포할 수 없으므로, 교사 테스터 12명·14일 계획이 필요하다. [2] |
| 내부 테스트 | 내부 테스트는 소수의 신뢰할 수 있는 테스터에게 빠르게 배포할 수 있으며, 프로덕션 접근 요건 자체는 아니다. | alpha 테스트는 우선 내부 테스트로 운영하고, 이후 비공개 테스트로 전환한다. [2] |
| Data safety | 비공개·공개·프로덕션 트랙의 게시 앱은 Data safety 양식을 작성해야 하며, 내부 테스트 전용 앱은 면제다. 데이터를 수집하지 않아도 양식과 개인정보 처리방침 링크가 필요하다. | 온디바이스 처리 구조라도 출시 전 개인정보 처리방침 공개 URL과 정확한 ‘수집·공유 없음’ 또는 실제 동작에 맞는 선언이 필요하다. [3] |
| SDK 책임 | Data safety에는 앱이 사용하는 모든 서드파티 라이브러리·SDK의 수집·공유 행위도 반영해야 한다. | LiteRT-LM, PDF 처리, 생체 인증, 앱이 실제 사용하는 분석·오류 보고 SDK를 출시 직전에 다시 점검해야 한다. [3] |
| 계정 유형 | Play Console은 개인·조직 계정을 제공하며 기능·수익화 기능은 같지만, 계정 유형 선택 뒤 검증 기준은 달라진다. | EunmaStudio를 공식 제공자로 공개하려면 조직 계정을 우선 검토한다. 계정 유형은 생성 뒤 변경할 수 없으므로 신중히 선택한다. [4] [5] |
| 조직 확인 | 조직 계정 검증에는 조직 등록 증빙, 공개 연락처·웹사이트 등이 필요하며 결제 프로필에는 D-U-N-S 번호가 필요할 수 있다. D-U-N-S 발급은 30일 이상 걸릴 수 있다. | 공개 출시 목표가 있으면 사업자 등록 정보·EunmaStudio 법적 명칭·D-U-N-S·지원 이메일·웹사이트를 먼저 준비한다. [5] |
| 앱 서명 | Play 배포용 App Bundle은 업로드 키로 서명해야 하며 Play App Signing을 설정한다. Debug 인증서는 앱 스토어 게시에 사용할 수 없다. | 현재 alpha Debug APK는 테스트 전용이다. 출시 전에는 업로드 키·암호 보관·서명된 release AAB·Play App Signing이 필요하다. [6] |
| 개인정보 처리방침 | 앱은 스토어 등록 정보와 앱 안에서 활성 URL의 개인정보 처리방침을 제공해야 하며, 정책은 수집·사용·공유와 민감 데이터 처리를 포괄해야 한다. | 온디바이스 처리·자동 백업 없음·모델 다운로드·알림·앱 잠금·공유 캐시·데이터 삭제 방식을 정확히 명시한다. [7] |
| App content | 광고 여부, 타겟 연령, 콘텐츠 등급, 제한 기능 접근 방법, 민감 권한 등을 App content에서 선언한다. | 광고 없음, 교육용 교사 도구 대상 연령, 내부 앱 잠금 해제 방법, 알림·파일 권한의 사용 목적을 정확히 입력한다. [7] |

## 출처

[1] [Google Play Help — Target API level requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)

[2] [Google Play Help — App testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)

[3] [Google Play Help — Provide information for Google Play's Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)

[4] [Google Play Help — Choose a developer account type](https://support.google.com/googleplay/android-developer/answer/13634885?hl=en)

[5] [Google Play Help — Verifying your Play Console developer account](https://support.google.com/googleplay/android-developer/answer/14177239?hl=en)

[6] [Android Developers — Sign your app](https://developer.android.com/studio/publish/app-signing)

[7] [Google Play Help — Prepare your app for review](https://support.google.com/googleplay/android-developer/answer/9859455?hl=en)
