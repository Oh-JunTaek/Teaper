# EunmaStudio Android Google Play 출시: 운영자 실행 체크리스트

## 결론

현재 Android 앱은 **테스트용 Debug APK** 단계이며, 아직 Play 스토어에 올릴 수 있는 출시물은 아니다. 운영자가 먼저 준비할 일은 **개발자 계정의 법적 주체 결정, 공개 연락처와 개인정보 처리방침, 테스터 확보**이다. 개발 측에서는 release AAB, Play App Signing, 정책 고지 초안, 스토어 등록 자료와 검증을 준비한다.

> **권장 경로:** 오늘은 alpha.7 실기기 검증을 마치고, 공개 출시 의사가 확정되면 EunmaStudio의 법적 운영 주체에 맞는 Play Console 계정을 만든 뒤 내부 테스트 → 비공개 테스트 → 프로덕션 순으로 진행한다.

## 운영자가 직접 해야 할 일

| 순서 | 운영자 할 일 | 결정·준비물 | 주의 사항 |
|---:|---|---|---|
| 1 | 개발자 계정 주체 결정 | **개인 계정** 또는 **조직 계정** 선택 | 계정 유형은 생성 후 바꿀 수 없다. EunmaStudio가 사업자·법인·기관 명의로 서비스할 계획이면 조직 계정을 우선 검토한다. [1] [2] |
| 2 | Google Play Console 개설·결제 프로필 연결 | 소유자 Google 계정, 결제 프로필, Console 화면에서 요구하는 등록 절차 | 등록 수수료와 계정 확인은 운영자가 직접 수행한다. 결제 기능을 도입하면 별도의 판매자·은행 확인이 필요할 수 있다. [2] |
| 3 | 계정 검증 자료 준비 | 개인: 법적 이름·주소·전화·공개 지원 이메일. 조직: 사업자/조직 등록 증빙, 법적 명칭·주소, 공개 연락처·웹사이트, 필요 시 D-U-N-S 번호 | 조직 정보는 공개 개발자 프로필과 정합해야 한다. D-U-N-S 발급에 30일 이상 걸릴 수 있으므로 조직 출시라면 먼저 확인한다. [2] |
| 4 | 공개 고객지원 채널 개설 | `support@...` 같은 지원 이메일, 문의 응답 담당자, 공개 웹사이트 | 개인 이메일·전화번호를 앱 사용자에게 노출하고 싶지 않다면 서비스 전용 지원 채널을 먼저 만든다. [2] |
| 5 | 개인정보 처리방침의 운영자 확정 | 운영 주체, 문의처, 모델 다운로드, 로컬 자료·대화 보관, 공유 파일, 삭제·백업 원칙 | 활성화된 공개 URL이 필요하며, 스토어와 앱 안에서 모두 연결해야 한다. 법률 자문이 필요한 부분은 운영자가 검토·확정한다. [3] |
| 6 | 테스터 모집·테스트 운영 | 교사·지인 등 실제 사용 목적에 가까운 테스터, 오류 보고 채널 | 신규 **개인 계정**은 프로덕션 접근 전 12명 이상이 14일 연속 참여한 비공개 테스트가 필요하다. 내부 테스트는 그 전에 소수 인원으로 사용한다. [4] |
| 7 | 스토어 공개 정보 승인 | 앱명, 짧은 설명, 상세 설명, 카테고리, 지원 이메일, 아이콘·스크린샷·소개 이미지, 타겟 연령 | ‘자동 출제’가 아니라 교사 검수형 자료 기반 보조 도구라는 설명을 유지하고, 성능·정확도를 과장하지 않는다. |
| 8 | 정책 선언 최종 확인 | Data safety, 광고 여부, 타겟 연령·콘텐츠 등급, 앱 접근 안내, 권한 사용 목적 | ‘데이터를 수집하지 않는다’는 선언은 출시 build와 실제 네트워크·SDK 동작을 다시 감사한 뒤에만 확정한다. [3] [5] |
| 9 | 배포 승인 | 내부 → 비공개 → 프로덕션 단계별 승인, 초기 출시 국가·지역·가격 결정 | 첫 공개는 제한된 국가·사용자·무료 배포로 시작하고, 테스트 결과와 정책 상태를 확인한 뒤 확대한다. |

## 개발 측에서 준비할 일

| 항목 | 준비 내용 | 현재 상태 |
|---|---|---|
| Release App Bundle | Debug APK 대신 release `.aab`를 생성하고 버전 코드·버전명을 관리 | **미착수** |
| 업로드 키·Play App Signing | 운영자 소유의 업로드 키를 안전한 비공개 보관소에 만들고, Play App Signing에 등록 | **미착수** |
| Target API | `targetSdk = 36` 유지 및 Android 16 동작 점검 | **구성 완료**, 실기기 확인 필요 [6] |
| 권한 최소화 | 인터넷·모델 다운로드 알림·포그라운드 데이터 동기화 외 불필요 권한 제거 | **구성 검토 필요** |
| 개인정보 처리방침 | 웹 공개 URL과 앱 내 링크, 실제 동작과 Data safety 답변의 일치 | **초안·운영자 확정 필요** |
| 제3자 고지 | Gemma Apache-2.0 NOTICE, LiteRT-LM·PDF·생체 인증 등 라이선스·데이터 동작 점검 | **출시 전 감사 필요** |
| 스토어 등록 자료 | 512px 아이콘, 휴대폰 스크린샷, 기능 소개 이미지, 한국어 설명, 지원 이메일 | **미착수** |
| 심사 안내 | 모델 다운로드가 필요한 흐름, 선택형 앱 잠금, 비민감 샘플로 시험 가능한 경로를 심사자 안내에 기재 | **미착수** |

## Data safety 초안 작성 전 반드시 확인할 질문

이 앱은 자료·문항·대화의 서버 업로드를 설계하지 않았지만, **모델을 다운로드할 때 외부 호스트와 통신**한다. 따라서 Data safety에 ‘수집·공유 없음’을 기계적으로 선택하면 안 된다. 출시 build에 포함된 라이브러리와 네트워크 요청을 최종 확인한 뒤 운영자가 사실에 맞게 제출해야 한다.

| 확인 질문 | 현재 예상 | 출시 전 확정 방법 |
|---|---|---|
| 자료·문항·채팅 내용을 EunmaStudio 서버나 분석 도구로 보내는가? | 설계상 보내지 않음 | release build의 네트워크 요청과 포함 SDK를 점검 |
| 모델 다운로드 시 어떤 정보가 외부로 나가는가? | 모델 파일 요청과 일반 네트워크 연결 정보가 발생할 수 있음 | 다운로드 공급자 약관·실제 요청·로그 보관 방식을 확인 |
| 광고·행동 분석·오류 수집 SDK가 있는가? | 현재 설계상 없음 | Gradle 의존성과 release manifest를 점검 |
| 사용자가 로컬 자료·대화·공유 캐시를 삭제할 수 있는가? | 일부 구현, 전체 삭제·보관 정책 보완 예정 | 앱 화면·개인정보 처리방침·Data safety 답변을 일치시킴 |

## 출시 순서

| 단계 | 운영자 행동 | 완료 기준 |
|---|---|---|
| A. 실기기 파일럿 | alpha.7로 S25+ 체크리스트 수행 | E2B·오프라인·채팅·문서 공유·앱 잠금이 통과 |
| B. 계정·정책 | 계정 주체·검증·지원 채널·개인정보 처리방침 확정 | Play Console의 계정·앱 콘텐츠 초안이 준비됨 |
| C. 서명 Release | 운영자와 별도 안전 경로로 업로드 키 생성·보관, release AAB 작성 | 내부 테스트에 올릴 AAB와 서명 체계가 준비됨 |
| D. 내부 테스트 | 소수의 교사에게 Play 내부 테스트 배포 | 설치·업데이트·크래시·다운로드 문제 확인 |
| E. 비공개 테스트 | 개인 계정이면 12명 이상·14일 연속 참여 요건 충족 | 프로덕션 접근 신청 조건 충족 [4] |
| F. 프로덕션 심사 | 정확한 Data safety·정책 선언·심사 안내와 함께 제출 | 심사 승인 후 제한 출시 여부 결정 |

## 지금 운영자에게 필요한 첫 결정

EunmaStudio가 향후 기관 납품·유료 서비스·직원 협업을 염두에 둔다면, **조직 계정으로 시작할지** 먼저 결정하는 것이 가장 중요하다. 아직 법적 조직 명의가 없고 개인 파일럿만 우선이라면 개인 계정으로 시작할 수 있으나, 공개 출시 전 비공개 테스트 요건과 공개되는 법적 이름·국가·지원 연락처를 감수해야 한다.

## 참고 자료

[1] [Google Play Help — Choose a developer account type](https://support.google.com/googleplay/android-developer/answer/13634885?hl=en)

[2] [Google Play Help — Verifying your Play Console developer account](https://support.google.com/googleplay/android-developer/answer/14177239?hl=en)

[3] [Google Play Help — Prepare your app for review: Privacy policy](https://support.google.com/googleplay/android-developer/answer/9859455?hl=en)

[4] [Google Play Help — App testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)

[5] [Google Play Help — Provide information for Google Play's Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)

[6] [Google Play Help — Target API level requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)

