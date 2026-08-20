# 개인 AI 제공자 권장 모델 조사 메모

조사일: 2026-08-20

## Gemini API

Google Gemini API의 공식 모델 문서는 안정(stable) 모델을 프로덕션 앱의 기본 선택으로 권장한다. 교육용 문항 생성의 사전 선택지는 `gemini-3.7-flash`(품질 우선), `gemini-3.6-flash`(균형), `gemini-3.5-flash-lite`(고빈도·비용 절약)로 구성한다. 실제 키가 가진 사용 가능 모델은 Gemini Models API로 확인할 수 있다.

- 모델 안내: <https://ai.google.dev/gemini-api/docs/models>
- Models API: <https://ai.google.dev/api/models>

## OpenAI API

OpenAI 공식 모델 문서는 GPT-5.6 계열에서 `gpt-5.6-sol`을 복잡한 추론·최고 품질, `gpt-5.6-terra`를 품질·비용 균형, `gpt-5.6-luna`를 대량 처리용으로 안내한다. 현재 애플리케이션은 OpenAI 호환 Chat Completions 경로를 사용하므로, 실제 선택 가능 여부는 각 사용자 키의 `/models` 조회로 확인한다.

- 모델 안내: <https://developers.openai.com/api/docs/models>
- 최신 모델 가이드: <https://developers.openai.com/api/docs/guides/latest-model>

## Claude API

Claude는 OpenAI 호환 Chat Completions API가 아니라 독자적인 Messages API를 사용하므로, 개인 Claude 키 지원에는 별도 제공자 어댑터가 필요하다. 공식 문서는 최신 Claude 계열을 품질·속도·비용 관점에서 Fable·Opus·Sonnet·Haiku로 구분하고, JSON Schema 기반 `output_config.format`의 구조화 출력을 지원한다. 문항 생성·검증의 JSON 계약과 호환된다.

- 모델 안내: <https://platform.claude.com/docs/en/about-claude/models/overview>
- 구조화 출력: <https://platform.claude.com/docs/en/build-with-claude/structured-outputs>

## 제품 결정

1. 교사 화면에는 모델명만 나열하지 않고 **품질 우선·균형·절약** 3개 선택지로 먼저 제시한다.
2. 권장 모델은 빠르게 바뀔 수 있으므로 사용자가 직접 모델명을 적을 수 있게 유지하고, 저장 뒤 연결 확인으로 해당 키의 접근 가능 여부를 검증한다.
3. 개인 Gemini·OpenAI·Claude 키는 사용자별로 암호화 저장하고, 해당 제공자에 자료·근거·교사 지시문이 전송되는 동의를 요청 단위로 다시 받는다.
