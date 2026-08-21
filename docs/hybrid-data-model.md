# 하이브리드 웹앱·로컬 앱 공통 데이터 모델

## 목적

교사도우미는 **문항·근거·검수 이력의 구조는 동일하게 유지**하고, 파일과 AI 실행 위치만 웹앱·로컬 앱·기관 서버에 따라 바꾼다. 이 원칙을 지키면 교사는 같은 검수 화면과 CSV 형식을 사용하면서 보안 수준에 따라 실행 환경을 선택할 수 있다.

| 공통 도메인 | 현재 서버 스키마 | 로컬 앱 저장소 | 동기화 원칙 |
|---|---|---|---|
| 사용자·역할 | `users` | `local_users` 또는 단일 교사 프로필 | 로컬 전용은 교사 프로필만 사용 |
| 참고 자료 | `reference_materials`, `material_chunks` | SQLite 메타데이터 + 암호화 파일 폴더 | 파일 원문은 자동 외부 동기화 금지 |
| 공식 문서 | `official_sources`, `official_documents` | SQLite 카탈로그 캐시 + 출처 URL·교사 선택 상태 | 원문은 복제하지 않고, 권리 상태·공식 링크·선택 근거를 보존 |
| 기출·샘플 | `reference_questions` | SQLite `reference_questions` | 원문 사용 범위·출처·선택 상태를 보존 |
| 생성 요청 | `generation_requests` | SQLite `generation_requests` | 제공자·모델·전송 동의 시각을 동일하게 기록 |
| 생성 문항·근거 | `generated_questions`, `generated_question_sources` | SQLite 동일 구조 | 문항·정답·해설·근거 참조를 그대로 유지 |
| 검수 이력 | `review_events` | SQLite 동일 구조 | 승인·수정·반려 사유를 변경 불가능한 이력으로 저장 |
| AI 제공자 | `ai_provider_settings` | 로컬 설정 메타데이터만 저장 | 비밀 키 자체는 별도 보안 저장소에 보관 |

## AI 제공자 공통 계약

각 실행 환경은 아래 입력·출력 계약을 준수한다.

```ts
type GenerationProvider = {
  kind: "managed" | "ollama" | "openai_compatible" | "gemini";
  model: string;
  externalTransfer: boolean;
  generateDraft(input: GenerationInput): Promise<QuestionDraft>;
  validateDraft(input: ValidationInput): Promise<ValidationResult>;
};
```

`externalTransfer`가 참인 경우에는 생성 요청마다 `externalTransferConsentAt`을 기록한다. 로컬 제공자는 이 필드를 기록하지 않으며, 제공자 설정·선택한 공식 문서·샘플 기출·생성 결과를 모두 동일한 요청 이력에 연결한다.

## 파일·AI 실행 경계

| 환경 | 파일 원문 | OCR/RAG | 문항 생성 | 외부 전송 |
|---|---|---|---|---|
| 웹앱 관리형 | 서버 객체 저장소 | 서버 | 관리형 AI | 서비스 정책에 따라 가능 |
| 웹앱 개인 API | 서버 객체 저장소 | 서버 | 개인 API | 요청별 명시 동의 필요 |
| 로컬 앱 | 암호화된 교사 PC 폴더 | 로컬 | Ollama/llama.cpp | 기본 차단 |
| 기관 서버 | 기관 내부 저장소 | 기관 서버 | 내부 GPU 모델 | 기관 정책에 따름 |

웹앱은 교사 PC의 `localhost`에 직접 접근하지 않는다. 로컬 앱 패키지의 브리지는 `LOCAL_APP_MODE=true`에서만 Ollama 상태·모델 목록을 확인하고 호출한다.

## 개인 API 키 보관 정책

### 웹앱

웹앱은 API 키를 화면·로그·문항 이력에 기록하지 않는다. 서버는 전용 암호화 키로 API 키를 암호화해 `ai_provider_settings.encryptedApiKey`에 보관하고, 화면에는 마스킹된 마지막 4자리만 표시한다. 키 사용은 소유자 ID와 제공자 설정 ID가 모두 일치할 때만 허용한다.

### 로컬 앱

로컬 앱은 API 키를 SQLite·설정 파일·브라우저 저장소에 저장하지 않는다. Windows에서는 Credential Manager, macOS에서는 Keychain, Linux에서는 Secret Service를 사용하는 OS 보안 저장소 어댑터를 사용한다. 해당 저장소를 사용할 수 없으면 사용자가 만든 암호로 암호화한 로컬 vault를 대체 경로로 사용하고, 잠금 해제 전에는 외부 제공자를 사용할 수 없다.

## 로컬 브리지의 최소 계약

로컬 앱 브리지는 `GET /health`, `GET /models`, `POST /generate`만 노출하며 loopback 인터페이스에만 바인딩한다. 웹 공개 주소·LAN 주소에서는 수신하지 않으며, 앱이 발급한 단기 세션 토큰 없이는 요청을 처리하지 않는다. 자료 파일은 브리지 밖으로 전송하지 않고, 문항 생성에 필요한 텍스트도 로컬 모델을 사용할 때에는 PC 내부에서만 처리한다.

## 테스트 기준

1. 다른 사용자 ID의 제공자 설정은 조회·검증·생성에 사용될 수 없어야 한다.
2. 외부 제공자는 설정 동의와 요청별 동의가 모두 없으면 호출될 수 없어야 한다.
3. 로컬 제공자는 웹앱 서버의 `localhost`로 호출되지 않아야 한다.
4. 요청 이력에는 제공자 유형·모델·선택 근거·전송 동의 시각이 기록되어야 한다.
5. 내보낸 문항은 실행 환경과 무관하게 `ID·문제·보기·정답·해설·출제 의도·난이도·배점·유형·모델·프롬프트 버전·검수 상태` 열 순서를 유지해야 한다.
