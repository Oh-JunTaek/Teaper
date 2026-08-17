# 교사도우미 로컬 실행 기반

이 폴더는 웹 배포와 분리된 **local-only 데스크톱 앱 기반**이다. Electron·Tauri UI 패키지는 이 bridge를 자식 프로세스로 실행하며, UI와 bridge는 모두 loopback(`127.0.0.1`)에서만 통신한다. LAN·공개 IP 수신과 웹앱 서버의 `localhost` 호출은 허용하지 않는다.

## 실행

로컬 PC에서 Node.js 22 이상과 Ollama를 설치한 뒤 아래처럼 실행한다. `LOCAL_VAULT_MASTER_KEY`는 32자 이상인 사용자 고유 키이며, 실제 데스크톱 패키지에서는 OS 보안 저장소로 대체한다.

```bash
cd desktop
LOCAL_VAULT_MASTER_KEY='32자 이상 무작위 키' pnpm start
```

시작 시 콘솔에 표시되는 세션 토큰은 데스크톱 UI가 bridge에 연결할 때만 사용한다. `GET /health`, `GET /models`, `GET /hardware`, `POST /generate`는 `Authorization: Bearer <token>`과 loopback 연결을 모두 요구한다.

## 데이터 경계

| 데이터 | 위치 | 외부 전송 |
|---|---|---|
| 자료·문항·검수·생성 이력 | 사용자 데이터 폴더의 SQLite | local-only에서는 차단 |
| 개인 API 키 | 암호화 vault | SQLite·로그에 저장 금지 |
| Ollama 호출 | `127.0.0.1:11434` | PC 밖으로 전송 금지 |
| CSV 내보내기 | 사용자가 선택한 로컬 경로 | 사용자가 직접 선택할 때만 |

개인 API 오류·모델 부재·한도 초과 시 이 기반은 다른 제공자로 자동 전환하지 않는다. UI는 오류 원인과 함께 **수동 검수** 또는 사용자가 명시적으로 선택한 다른 실행 방식을 제시해야 한다.
