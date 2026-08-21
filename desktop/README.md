# 교사도우미 로컬 실행 기반

이 폴더는 웹 배포와 분리된 **local-only 데스크톱 앱 기반**이다. Electron·Tauri UI 패키지는 이 bridge를 자식 프로세스로 실행하며, UI와 bridge는 모두 loopback(`127.0.0.1`)에서만 통신한다. LAN·공개 IP 수신과 웹앱 서버의 `localhost` 호출은 허용하지 않는다.

## 현재 범위

이 폴더는 **데스크톱 설치 프로그램 이전의 실행 기반**이다. 일반 교사가 더블클릭으로 사용할 설치형 UI는 다음 단계에서 Electron 또는 Tauri로 패키징한다. 현재는 설치 마법사가 사용할 loopback bridge, 사양 점검, 모델 권장, 암호화 저장소, SQLite 이력을 검증할 수 있다.

### 초기 로컬 배포의 AI 정책

초기 로컬 배포는 **로컬 모델 전용**이다. 교사는 Ollama 또는 llama.cpp로 PC에서 실행되는 모델만 선택할 수 있으며, Gemini·OpenAI·Claude 등 외부 개인 API 키를 로컬 앱에 등록하거나 문항 생성에 사용할 수 없다. 이 정책은 시험 예정 문항과 첨부 자료가 외부 AI 제공자에게 전송될 가능성을 초기 단계에서 없애기 위한 것이다.

로컬 모델 자체를 처음 내려받는 과정은 네트워크를 사용하지만, 교사가 모델·라이선스를 확인하고 명시적으로 준비를 승인한 경우에만 허용된다. 준비가 끝난 후 로컬 생성에 사용되는 자료, 프롬프트, 문항, 정답·해설은 교사 PC 안에서 처리한다.

## 교사용 권장 준비 흐름

1. Windows용 Ollama 설치 파일을 공식 다운로드 페이지에서 내려받아 설치한다.
2. 데스크톱 앱의 `GET /setup-plan`이 PC 메모리·GPU·현재 모델을 확인한다.
3. 앱이 권장한 `qwen3:4b`, `qwen3:8b`, `qwen3:14b` 중 하나를 교사가 선택한다.
4. 교사가 다운로드·모델 라이선스 확인에 동의하면 `POST /models/pull`이 Ollama에 해당 모델 준비를 요청한다.
5. 설치가 끝난 뒤 짧은 생성 점검을 하고 local-only 모드로 문항을 생성한다.

Ollama 설치 파일을 기본 경로로 쓰고, CMD·PowerShell·llama.cpp는 설치가 실패하거나 특수 하드웨어를 쓰는 경우의 고급 지원 경로로만 제공한다.

## 개발·검증 실행

로컬 PC에서 Node.js 22 이상과 Ollama를 설치한 뒤 아래처럼 실행한다. `LOCAL_VAULT_MASTER_KEY`는 32자 이상인 사용자 고유 키이며, 실제 데스크톱 패키지에서는 OS 보안 저장소로 대체한다.

```bash
cd desktop
LOCAL_VAULT_MASTER_KEY='32자 이상 무작위 키' pnpm start
```

시작 시 콘솔에 표시되는 세션 토큰은 데스크톱 UI가 bridge에 연결할 때만 사용한다. `GET /health`, `GET /models`, `GET /hardware`, `GET /setup-plan`, `POST /models/pull`, `POST /generate`는 `Authorization: Bearer <token>`과 loopback 연결을 모두 요구한다. 모델 다운로드는 교사가 `confirmDownload: true`로 명시 확인한 권장 모델만 허용한다.

## 데이터 경계

| 데이터 | 위치 | 외부 전송 |
|---|---|---|
| 자료·문항·검수·생성 이력 | 사용자 데이터 폴더의 SQLite | local-only에서는 차단 |
| 개인 API 키 | 초기 로컬 배포에서는 사용하지 않음 | 외부 API 호출 경로 비활성화 |
| Ollama 호출 | `127.0.0.1:11434` | PC 밖으로 전송 금지 |
| CSV 내보내기 | 사용자가 선택한 로컬 경로 | 사용자가 직접 선택할 때만 |

모델 부재·실행 오류·성능 부족 시 이 기반은 외부 개인 API로 자동 전환하지 않는다. UI는 오류 원인과 함께 **수동 검수** 또는 사용자가 명시적으로 선택한 다른 로컬 모델 실행 방식을 제시해야 한다.
