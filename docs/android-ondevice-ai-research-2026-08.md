# Android 온디바이스 AI·Google Play 확장 조사 메모

**조사일:** 2026-08-21  
**목적:** EunmaStudio 문제 출제 워크스페이스의 독립형 Android 앱 및 로컬 AI 실행 가능성 검토

## 1. 확인된 기술 사실

Google AI Edge Gallery는 휴대기기에서 공개 모델을 오프라인으로 실험하고, 모델을 내려받거나 자체 모델을 가져와 실행하는 별도 샌드박스 앱이다.[1] [2] LiteRT-LM은 Android를 포함한 여러 플랫폼에서 LLM을 실행하기 위한 런타임이며, `.litertlm` 형식의 호환 모델을 앱에 통합해 CPU·GPU·NPU 실행 경로를 선택할 수 있다.[3] [4]

Android는 앱마다 고유 UID와 앱 샌드박스를 적용한다. Android 11 이상에서 다른 앱의 내부 데이터 디렉터리와 전용 외부 저장소 디렉터리는 기본적으로 접근할 수 없다.[5] [6] 따라서 AI Edge Gallery가 자기 앱 전용 저장소에 내려받은 모델을 EunmaStudio 앱이 직접 찾아 재사용하는 구조는 기본적으로 성립하지 않는다. AI Edge Gallery가 향후 공식 `ContentProvider`·바인드 서비스·문서 제공자 API를 명시적으로 제공하지 않는 한, 해당 모델을 우리 앱의 런타임으로 사용한다는 전제를 제품 설계에 두어서는 안 된다.

사용자가 파일을 명시적으로 선택하는 방식은 가능하다. Android Storage Access Framework는 사용자가 시스템 파일 선택기에서 제공자가 노출한 문서를 고르면 앱에 권한을 부여하는 구조다.[7] 다만 Android 11 이상에서는 다른 앱의 `Android/data` 전용 디렉터리를 이 선택기로도 접근할 수 없으므로, AI Edge Gallery의 사적 모델 파일을 고르는 일반 경로로 기대할 수 없다.[6]

## 2. 독립형 앱 권고 구조

| 구성 | 권고 | 근거 |
|---|---|---|
| 모델 파일 | EunmaStudio 앱이 자체 모델 카탈로그에서 직접 다운로드 후 앱 전용 저장소에 보관 | 앱 간 사적 저장소 접근을 전제로 하지 않음 |
| 실행 런타임 | LiteRT-LM Android 네이티브 모듈을 React Native/Expo 앱에 연결 | Android·GPU·NPU 실행 경로를 앱이 직접 제어 |
| 모델 형식 | 우선 `.litertlm` 카탈로그, 기기·SoC별 호환 목록 제공 | LiteRT-LM 런타임과 호환 모델 형식이 공식 문서에 명시됨 |
| 고급 수동 가져오기 | 앱이 제공하는 파일 선택기로 사용자가 합법적으로 확보한 호환 모델을 복사·검증 | 사용자가 선택한 파일만 접근하며, Gallery 내부 저장소에 의존하지 않음 |
| 자료·문항 저장 | 암호화된 앱 전용 DB·파일 저장소, 내보내기만 사용자 선택 위치에 작성 | 시험 문항·교사 자료 보호와 Android 샌드박스 원칙에 부합 |
| 저사양 기본값 | 텍스트 문항 생성은 경량 모델부터, 이미지 질의는 별도 기능 플래그 | 모델 크기·기기 발열·RAM·NPU 지원 편차를 관리 |

## 3. Google Play 출시 핵심 조건

Google Play에 게시되는 앱은 데이터 수집 여부와 무관하게 Data safety 양식을 작성하고 공개 개인정보 처리방침 링크를 제공해야 한다.[8] 카메라·사진·파일 접근 또는 외부 AI 전송 기능을 추가할 경우에는 해당 처리와 제3자 SDK의 처리까지 실제 동작과 일치하도록 고지해야 한다.[8] [9]

2026-08-31부터 신규 앱과 업데이트는 Android 16(API 36) 이상을 target SDK로 제출해야 한다.[10] Google Play App Signing과 Android App Bundle(AAB) 기반 배포, 내부/비공개 테스트 트랙, 실제 기기 성능 검증이 필요하다.[11]

모델을 앱에서 직접 제공하거나 내려받게 하면 모델별 약관도 배포 설계에 포함해야 한다. **현재 대상인 Gemma 4 E2B·E4B는 Apache-2.0으로 제공**되며, 재배포 시 라이선스·저작권·NOTICE 보존 조건을 충족해야 한다.[12] Google의 Gemma 3 Android 예제는 앱이 Hugging Face 로그인과 약관 동의를 거쳐 LiteRT Community의 양자화 모델을 직접 내려받아 기기에서 실행하는 흐름을 제시한다.[13] 즉 독립 앱의 직접 다운로드는 기술적으로 가능한 경로지만, 모델마다 **다운로드 권한·라이선스/NOTICE 표시·해시 검증**을 제품 흐름에 반영해야 한다.

### Gemma 4 E2B·E4B 한정 권고

Google AI Edge 공식 LiteRT-LM 모델 페이지는 Android 모바일·엣지 배포 대상으로 E2B·E4B를 제시하며, LiteRT-LM 파일 크기를 E2B **2.58GB**, E4B **3.65GB**로 공개한다.[14] 같은 페이지의 Android S26 Ultra 측정은 E2B에서 CPU 최고 메모리 1,733MB 또는 GPU 676MB, E4B에서 CPU 3,283MB 또는 GPU 710MB를 예시로 든다. 이는 특정 플래그십 기기의 벤치마크일 뿐 일반 최소 사양은 아니다.[14]

따라서 EunmaStudio 앱은 E2B를 기본 모델로 고정하고, 다운로드 전 **최소 5GB 가용 저장 공간**을 확인하는 보수적 정책을 사용한다. E4B는 3.65GB 파일과 실행 여유를 고려해 **최소 7GB 가용 저장 공간**, **총 메모리 8GB 이상**, **과열 상태 아님**을 만족할 때만 ‘고성능 기기용’으로 권장한다. 이 기준은 Google이 보장하는 일반 최소 사양이 아니라, 앱이 다운로드 실패·저장 공간 부족·발열 위험을 줄이기 위해 적용하는 초기 파일럿 기준이다. 실제 기기 데이터로 조정해야 한다.

LiteRT-LM Android Kotlin API는 Gradle 의존성 `com.google.ai.edge.litertlm:litertlm-android`를 제공하며, 모델 초기화는 UI 스레드 밖에서 수행해야 한다. GPU 사용 시 `libvndksupport.so`와 `libOpenCL.so`를 선택적 native library로 선언해야 한다.[15]

## 4. 제품 판단

> **권고:** AI Edge Gallery는 현재 기능·모델 성능을 체험하는 비교 기준으로만 사용하고, EunmaStudio 모바일 앱은 자체 모델 다운로드·검증·저장·실행 경로를 갖춘 독립 앱으로 설계한다.

독립형 앱은 초기 개발 비용과 다운로드·저장 공간 관리 책임이 늘어나지만, 교사에게 일관된 자료 관리·문항 검수·보안 경계·지원 경험을 제공할 수 있다. 반대로 Gallery 모델 재사용에 의존하면 Android 저장소 격리, Gallery 버전 변경, 모델 포맷·권리 조건 변화로 서비스 안정성이 낮아진다.

## 5. 참고 자료

[1] [Google AI Edge Gallery](https://developers.google.com/edge/gallery)

[2] [Google AI Edge Gallery GitHub](https://github.com/google-ai-edge/gallery)

[3] [LiteRT-LM 개요](https://developers.google.com/edge/litert-lm)

[4] [LiteRT-LM Android NPU 실행](https://developers.google.com/edge/litert/next/litert_lm_npu)

[5] [Android Application Sandbox](https://source.android.com/docs/security/app-sandbox)

[6] [Android 11 저장소 변경](https://developer.android.com/about/versions/11/privacy/storage)

[7] [Android Storage Access Framework](https://developer.android.com/guide/topics/providers/document-provider)

[8] [Google Play Data safety 양식](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)

[9] [Google Play User Data 정책](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)

[10] [Google Play target API 요건](https://developer.android.com/google/play/requirements/target-sdk)

[11] [Google Play Integrity·App Signing](https://developer.android.com/google/play/integrity)

[12] [Gemma 4 Apache 2.0 License](https://ai.google.dev/gemma/apache_2)

[13] [Gemma 3 on mobile and web with Google AI Edge](https://developers.googleblog.com/gemma-3-on-mobile-and-web-with-google-ai-edge/)

[14] [Gemma 4 LiteRT-LM 모델](https://developers.google.com/edge/litert-lm/models/gemma-4)

[15] [LiteRT-LM Android Kotlin API](https://developers.google.com/edge/litert-lm/android)
