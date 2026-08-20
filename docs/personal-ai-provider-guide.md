# 개인 AI 제공자 및 권장 모델 안내

교사도우미는 기본 관리형 AI 외에도, 교사가 본인 계정의 **Gemini·OpenAI·Claude API 키**를 등록해 문항 생성과 검증에 사용할 수 있다. 개인 키는 사용자별로 암호화해 저장하며, 다른 교사·게스트 계정과 공유하지 않는다.

개인 AI를 선택한 생성 요청에서는 문항 조건, 선택한 교육과정·참고 자료·기출 유형의 텍스트, 교사가 저장한 추가 작성 선호가 해당 AI 제공자에게 전송될 수 있다. 따라서 출시 예정 문항, 학생 개인정보, 제3자에게 공개할 권한이 없는 자료는 개인 API 사용 전에도 반드시 분리·점검해야 한다.

## 교사용 선택 방법

AI 설정에서 실행 방식을 고른 뒤, 아래의 **품질 우선·균형·절약** 버튼 중 하나를 선택한다. 모델명은 직접 수정할 수 있으며, 저장 뒤 **연결 확인**으로 현재 키가 해당 제공자에 연결되는지 확인한다. 모델 정책·가용성·무료 구간은 제공자 계정에 따라 달라질 수 있으므로, 연결 확인 결과와 제공자 콘솔을 함께 확인한다.

| 제공자 | 품질 우선 | 균형 기본값 | 절약 | 연결 방식 |
|---|---|---|---|---|
| Google Gemini | `gemini-3.7-flash` | `gemini-3.6-flash` | `gemini-3.5-flash-lite` | Google AI Studio 개인 키 |
| OpenAI | `gpt-5.6-sol` | `gpt-5.6-terra` | `gpt-5.6-luna` | OpenAI 개인 키 |
| Anthropic Claude | `claude-opus-5` | `claude-sonnet-5` | `claude-haiku-4-5` | Anthropic Console 개인 키 |

> **중요:** 권장 목록은 모델 선택을 쉽게 하기 위한 초기값이며, 특정 모델의 무료 제공·가격·계정별 사용 가능 여부를 보장하지 않는다. 오류가 나면 다른 권장 모델을 선택하거나, 제공자 콘솔에서 해당 키의 모델 접근 권한을 먼저 확인한다.

## 제공자별 기술 경계

Gemini와 Claude는 제공자 고유 API 형식으로 연결한다. OpenAI는 OpenAI 표준 Chat Completions 호환 주소로 연결하며, 다른 호환 제공자를 쓰려는 고급 사용자는 제공자가 안내한 HTTPS 기본 주소와 모델명을 직접 입력할 수 있다. Claude는 Messages API와 JSON Schema 구조화 출력을 사용해, 문항·정답·해설·검수 결과의 공통 JSON 계약을 유지한다.

## 운영 권장사항

개인 API 키는 교사 본인의 계정·결제·한도 정책에 따라 관리한다. 파일럿 게스트 계정은 공용 작업공간이므로 개인 API 키 등록에 사용하면 안 된다. 각 생성 요청에는 외부 전송 범위 확인을 다시 요구하며, 교사는 생성 결과를 반드시 검수한 뒤 사용해야 한다.

## 참고한 공식 자료

- Google Gemini API Models: <https://ai.google.dev/gemini-api/docs/models>
- OpenAI Models: <https://developers.openai.com/api/docs/models>
- Anthropic Claude Models: <https://platform.claude.com/docs/en/about-claude/models/overview>
- Anthropic Structured Outputs: <https://platform.claude.com/docs/en/build-with-claude/structured-outputs>
