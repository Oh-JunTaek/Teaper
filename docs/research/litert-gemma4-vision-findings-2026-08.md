# LiteRT-LM · Gemma 4 온디바이스 이미지 입력 조사 메모

**조사일:** 2026-08-22

| 확인 항목 | 공식 확인 결과 | 설계 영향 |
| --- | --- | --- |
| Kotlin 이미지 입력 | LiteRT-LM Android API는 호환 모델에서 `EngineConfig(visionBackend = Backend.GPU())`와 `Contents.of(Content.Text(...), Content.ImageFile(path))`를 제공 | 현재 텍스트 전용 `sendMessage` 경로와 별도의 이미지 완료형 호출을 구현 가능 |
| Gemma 4 모델 능력 | Gemma 4 전 모델은 이미지 입력을 지원하며, E2B·E4B는 오디오도 네이티브 지원 | E2B·E4B만 사용하는 앱 정책과 이미지 Q&A 기능이 정합 |
| 모바일 메모리 | 공식 모바일 추정치는 E2B 1.1GB, E4B 2.5GB이며 문맥 KV 캐시·이미지 처리 메모리는 별도 | E2B 기본, E4B는 고성능 기기 권장 및 이미지 1장·축소·짧은 문맥 제한 필요 |
| 가속 | LiteRT-LM은 Android GPU/NPU 가속을 지원하며 Vision Backend를 별도 설정 가능 | 이미지 모드는 GPU 우선·CPU 폴백이 필요하며, 기존 CPU 안정성 텍스트 채팅과 분리해야 함 |

## 핵심 공식 근거

1. LiteRT-LM API Overview의 Kotlin 예제는 멀티모달 모델에 `visionBackend = Backend.GPU()`를 설정하고 `Content.ImageFile("path/to/image.jpg")`를 텍스트와 함께 `sendMessage` 하는 방식을 제시한다.
   - https://developers.google.com/edge/litert-lm/api_overview
2. Gemma 4 모델 개요는 E2B·E4B가 모바일·에지 배포 대상이며, 모든 Gemma 4 모델이 이미지 입력을 처리한다고 설명한다. E2B·E4B는 오디오도 네이티브 지원한다.
   - https://ai.google.dev/gemma/docs/core
3. LiteRT-LM Gemma 4 모델 문서는 Android 성능·메모리 표와 E2B 2.58GB, E4B 3.65GB 모델 크기를 제공한다.
   - https://developers.google.com/edge/litert-lm/models/gemma-4
4. LiteRT-LM Overview는 Android GPU/NPU 가속과 멀티모달 비전·오디오 지원을 명시한다.
   - https://developers.google.com/edge/litert-lm/overview

## 구현 전제

- **이미지 파일은 외부 전송 없이 앱 전용 캐시에서 처리하고, 답변 확정 뒤 즉시 원본 캐시를 삭제한다.**
- 사진은 1회 1장, JPEG/PNG, 해상도·용량 상한으로 시작한다.
- 이미지 질의응답 중에는 텍스트 채팅 엔진과 별도 Conversation을 열고 항상 닫아 KV 캐시 누적을 피한다.
- E4B와 GPU 모드가 초기화·생성에 실패하면 고정 오류 화면을 제공하고 CPU 폴백 또는 E2B 전환을 선택하게 한다. 지원 밖 설정을 조용히 무시하는 원칙은 유지한다.
