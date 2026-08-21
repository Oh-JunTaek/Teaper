# EunmaStudio 문제 출제 워크스페이스 Android 앱 확장 로드맵

**결론:** Android 앱은 **AI Edge Gallery와 독립적으로** 모델을 내려받고 실행하는 구조를 권장한다. AI Edge Gallery에 설치된 모델을 우리 앱이 직접 재사용하는 방식은 제품 기능으로 전제하지 않는다. Android의 앱 샌드박스와 scoped storage 때문에 다른 앱의 전용 저장소에 있는 모델 파일을 직접 읽을 수 없기 때문이다.[1] [2]

## 1. 질문에 대한 직접 답변

| 질문 | 답변 | 권고 |
|---|---|---|
| 우리 앱에서 모델을 직접 다운로드할 수 있는가? | **가능하다.** LiteRT-LM은 Android 앱 통합과 `.litertlm` 모델 실행을 지원한다.[3] [4] | 앱 내부 모델 카탈로그에서 교사가 선택·동의 후 직접 다운로드 |
| Edge Gallery 모델을 우리 앱에서 그대로 사용할 수 있는가? | **일반적으로 불가하며, 의존하면 안 된다.** Gallery의 앱 전용 파일은 다른 앱이 접근할 수 없다.[1] [2] | Edge Gallery는 성능 비교·체험 도구로만 활용 |
| 사용자가 파일을 직접 가져올 수 있는가? | **제한적으로 가능하다.** 사용자가 시스템 파일 선택기에서 노출된 호환 모델 파일을 고르면 가져올 수 있다.[5] | 초기에는 EunmaStudio 검증 모델만 제공하고, 이후 고급 설정으로 분리 |
| 독립 앱이 더 나은가? | **예.** 모델·자료·문항·검수·지원 범위를 일관되게 통제할 수 있다. | Android 전용 모델 관리자와 로컬 저장소 구현 |

> AI Edge Gallery는 훌륭한 **참조 앱**이지만, EunmaStudio의 실행 엔진이나 모델 저장소가 되어서는 안 됩니다. 독립 앱은 초기 구현량이 늘어나지만 교사 자료와 시험 문항의 보안·지원·업데이트 책임 경계를 명확히 합니다.

## 2. 권장 앱 구조

### 2.1 앱 구성

```text
교사용 Android 앱 (React Native/Expo + Android Kotlin 네이티브 모듈)
 ├─ 출제 작업 화면: 자료 · 기출 · 생성 · 검수 · 내보내기
 ├─ 로컬 AI 설정: 기기 진단 · 모델 카탈로그 · 다운로드 · 삭제
 ├─ LiteRT-LM Kotlin 모듈: CPU/GPU 우선, NPU는 호환 기기만 선택
 ├─ 로컬 보안 저장: Android Keystore + 암호화 DB/파일
 ├─ 모델 저장소: 앱 전용 filesDir/models/<모델-버전>
 └─ 선택형 웹 동기화: 교사가 명시적으로 연결할 때만 사용
```

React Native/Expo는 웹앱과 화면·도메인 모델을 재사용하기 좋지만, LiteRT-LM 실행은 Android 네이티브 의존성이므로 **Expo Go만으로는 충분하지 않다.** Kotlin 네이티브 모듈과 개발 빌드/프로덕션 AAB 빌드가 필요하다. 웹의 tRPC 계약·교육과정 범위·검수 결과 형식·DOCX/CSV 출력 모델은 공유하고, 추론·파일 저장·Keystore는 Android 전용으로 구현한다.

### 2.2 독립 모델 관리자

모델을 APK/AAB에 모두 넣지 않는다. 앱 최초 설치 용량이 과도해지고, 모델별 라이선스·업데이트·기기 호환을 제어하기 어렵기 때문이다. 대신 EunmaStudio가 서명한 모델 카탈로그를 제공한다.

| 카탈로그 항목 | 앱이 확인할 내용 |
|---|---|
| 모델 식별자·표시명 | 예: `gemma-4-e2b-it`와 교사용 설명 |
| 파일 형식·URL | `.litertlm` 검증 모델의 HTTPS 다운로드 경로 |
| SHA-256·파일 크기 | 다운로드 완료 후 무결성·저장 공간 대조 |
| 기기 조건 | 최소 RAM, 권장 저장 공간, CPU/GPU/NPU 호환 여부 |
| 용도 제한 | 텍스트 문항 보조, 이미지 질의, 긴 자료 요약 등 |
| 라이선스·Notice | 다운로드 전 동의와 앱 내 재열람 경로 |
| 모델 상태 | 권장·실험·철회·업데이트 필요 |

모델 파일은 앱 전용 저장소에 원자적으로 저장하고 해시가 맞을 때만 활성화한다. 모델 파일 자체는 교사 자료가 아니지만, 문항·첨부 자료·색인·대화 이력은 Android Keystore를 바탕으로 암호화한 앱 전용 저장소에 둔다. 앱 삭제 시 앱 전용 데이터도 사라질 수 있으므로 암호화 백업·복구와 명시적 내보내기 기능을 모바일에도 제공한다.[1]

Gemma를 직접 배포하면 적용 모델의 라이선스를 모델별로 검토해야 한다. 일반 Gemma 약관은 제3자 배포 시 사용 제한 고지, 약관 사본, 수정 고지 및 Notice 파일을 요구한다.[6] Google의 모바일 예제도 앱에서 사용자가 Hugging Face 로그인과 약관 동의를 거쳐 모델을 직접 받는 흐름을 사용한다.[7] 따라서 초기 앱은 **EunmaStudio 검증 모델만 직접 다운로드**하게 하고, 모델 라이선스 화면·동의 기록·Notice를 다운로드 단위로 제공한다.

### 2.3 AI Edge Gallery와의 관계

AI Edge Gallery는 모델을 내려받고 자체 모델을 가져와 성능을 시험하는 온디바이스 실험 앱이다.[8] 사용자가 Gallery에서 내려받은 모델은 그 앱의 전용 저장소에 있을 가능성이 높고, Android 11 이상에서는 다른 앱이 그 전용 디렉터리에 접근할 수 없다.[2] 따라서 다음 경계를 둔다.

| 방식 | 채택 여부 | 이유 |
|---|---:|---|
| Gallery 모델 파일을 자동 탐색·재사용 | 채택 안 함 | 앱 샌드박스·저장소 격리와 Gallery 구현 변경에 취약 |
| Gallery 앱을 외부 실행 도구로 연결 | 초기 미채택 | 출제 작업 이력과 검수·자료 보안 경계가 분리됨 |
| 앱 내 독립 다운로드·실행 | **채택** | 모델·라이선스·해시·지원 범위를 앱이 통제 |
| 사용자가 SAF로 호환 파일 가져오기 | 후속 고급 기능 | 사용자가 합법적으로 확보한 공개 파일만 명시적으로 선택 |

## 3. 모바일 기능 범위

모바일은 PC와 완전히 동일한 입력 작업을 즉시 복제하기보다, 화면 크기와 모바일 모델의 제약을 반영해 단계적으로 확대한다.

| 단계 | 사용자 기능 | 로컬 AI 범위 | 출시 판단 기준 |
|---|---|---|---|
| M0: 설계·기기 조사 | 지원 기기·저장 공간·개인정보 흐름 확인 | 실행하지 않음 | Android 기기군과 최소 사양 확정 |
| M1: 교사 동반 앱 | 자료 열람, 검수, 수정 사유, DOCX/PDF 공유, 웹 동기화 선택 | 없음 또는 짧은 안내문 | 웹앱 검수 흐름을 모바일에서 안전하게 완료 |
| M2: 로컬 텍스트 보조 | 자료 메모, 출제 의도 정리, 단문 문항 변형, 계산 검수 결과 확인 | Gemma 경량 텍스트 모델 1종 | 발열·메모리·응답 시간·오프라인 안정성 통과 |
| M3: 로컬 자료 기반 생성 | 자료 선택, 로컬 색인, 문항 생성·검수·암호화 백업 | 검증 모델 2~3종, CPU/GPU 기본 | 과목별 회귀 검수 묶음 통과 |
| M4: 이미지·사진 자료 | 사진 선택, 문서 페이지 확인, 이미지 질의 | 멀티모달 모델은 기기별 제한 | 카메라/사진 권한 고지·전송 없음·기기 호환 검증 |

초기 모바일의 기본은 **텍스트 모델 1종**이다. 사용자가 제시한 Gemma 4 E2B/E4B 같은 모델은 좋은 후보지만, 실제 권장 여부는 앱이 기기 RAM·저장 공간·발열·LiteRT-LM 백엔드 호환성을 확인한 결과로 결정해야 한다. Google의 Gemma 3 모바일 예제도 1B 양자화 모델을 약 529MB로 제시하면서 성능은 기기 하드웨어·상태에 따라 달라진다고 명시한다.[7] 따라서 모델 이름만으로 ‘모든 휴대폰에서 가능’하다고 안내해서는 안 된다.

## 4. Google Play 출시 준비물

| 영역 | 준비 항목 | EunmaStudio 정책 적용 |
|---|---|---|
| 빌드·서명 | Android App Bundle(AAB), Play App Signing, 내부→비공개→공개 테스트 트랙 | 웹·Windows 테스트와 별개로 Play Console 출시 절차 운영 |
| SDK | 2026-08-31 이후 신규/업데이트 앱은 target API 36 이상 | Expo/Android 의존성을 API 36 기준으로 고정·검증 |
| 개인정보 | 공개 개인정보 처리방침, Data safety 양식, SDK 포함 실제 처리 고지 | 기본 로컬 모드는 자료·문항 외부 전송 없음으로 설계하되 실제 동작과 일치시킴 |
| 권한 | 사진/카메라/파일은 기능 진입 직전에 최소 권한 요청 | ‘자료 읽기’ 목적을 앱 내에 명시하고 거부해도 다른 기능은 사용 가능하게 설계 |
| 계정 | 모바일에서 계정을 생성하면 앱 안·웹 밖 모두에서 삭제 요청 경로 제공 | 웹 동기화 기능을 활성화할 때만 계정 흐름 적용 |
| 모델 권리 | 모델 라이선스, Notice, 약관 동의, 배포 파일 해시 | 모델 카탈로그에서 개별 모델마다 확인·기록 |
| 품질 | 실제 Android 기기별 발열·메모리·오프라인·백업 복구·문서 출력 시험 | 파일럿 교사가 기출 원문 없이 테스트 데이터를 사용해 확인 |

Google Play에서는 데이터 수집이 없더라도 Data safety 양식과 공개 개인정보 처리방침을 요구한다.[9] 개인정보·민감 자료 접근 또는 제3자 SDK·AI 연동을 쓴다면 앱 내부의 명확한 고지와 적극적 동의가 필요하다.[10] 신규 앱은 2026-08-31부터 Android 16(API 36) 이상을 target해야 한다.[11]

## 5. 즉시 착수 권고

1. **M0 기기 조사**를 먼저 진행한다. 교사 5명 이하의 Android 기기에서 RAM·저장 공간·칩셋·Android 버전·발열·다운로드 가능 용량만 익명화해 수집한다. 실제 시험 문항과 계정 식별 정보는 수집하지 않는다.
2. **독립 모델 카탈로그 PoC**를 만든다. Gemma 경량 모델 1종과 LiteRT-LM CPU/GPU 실행, SHA-256 검증, 삭제, 라이선스 동의, 기기 진단만 구현한다. 이 단계에서 AI Edge Gallery 연동은 넣지 않는다.
3. **M1 검수 동반 앱**을 만든다. 기존 웹 계정과 선택적으로 연결하되, 교사가 승인 문항을 보고 수정·반려·PDF/DOCX 공유를 할 수 있도록 한다. 이후 M2의 로컬 텍스트 보조를 추가한다.

## 6. 참고 자료

[1] [Android 앱 전용 저장소](https://developer.android.com/training/data-storage/app-specific)

[2] [Android 11 Scoped Storage 및 다른 앱 데이터 접근 제한](https://developer.android.com/about/versions/11/privacy/storage)

[3] [LiteRT-LM](https://developers.google.com/edge/litert-lm)

[4] [LiteRT-LM Android NPU 실행](https://developers.google.com/edge/litert/next/litert_lm_npu)

[5] [Android Storage Access Framework](https://developer.android.com/guide/topics/providers/document-provider)

[6] [Gemma Terms of Use](https://ai.google.dev/gemma/terms)

[7] [Gemma 3 on Mobile and Web with Google AI Edge](https://developers.googleblog.com/gemma-3-on-mobile-and-web-with-google-ai-edge/)

[8] [Google AI Edge Gallery](https://developers.google.com/edge/gallery)

[9] [Google Play Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)

[10] [Google Play User Data Policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)

[11] [Google Play Target API Requirements](https://developer.android.com/google/play/requirements/target-sdk)
