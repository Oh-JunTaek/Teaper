# Gemma 경량 모델 검토 메모

Gemma 3n의 `E2B`와 `E4B`는 노트북·태블릿·휴대전화 같은 일상 기기에서 효율적으로 실행하도록 설계됐고, Ollama는 `gemma3n:e2b`와 `gemma3n:e4b` 태그를 제공한다. [1] Google AI Edge Gallery는 모바일·노트북에서 기기 내 모델을 오프라인으로 실험할 수 있는 환경을 제공한다. [2]

따라서 교사도우미는 `gemma3n:e2b`를 **초경량 체험·모바일 연구 후보**, `gemma3n:e4b`를 **저사양 PC의 대안**으로 제공한다. 그러나 화학 I의 복합 근거 종합·정답 검증에서는 표준 Qwen 8B 이상보다 결과 편차가 커질 수 있으므로, 경량 모델 결과는 반드시 검수함의 근거·정답·해설 대조를 거쳐야 한다.

| 권장 위치 | 모델 | 역할 |
|---|---|---|
| 저사양·초기 체험 | `gemma3n:e2b` | PC/모바일 온디바이스 가능성 확인, 간단한 개념 문항 |
| 저사양 PC | `gemma3n:e4b` | 제한된 환경의 문항 생성 보조 |
| 일반 교사 PC | `qwen3:8b` | 화학 I 근거·해설 균형 |
| 고사양 PC | `qwen3:14b` | 복잡한 근거 종합 |

모바일 서비스는 별도 제품 단계다. 현재 로컬 서비스는 Windows 데스크톱 Ollama를 기본 경로로 유지하며, 모바일은 Edge Gallery·LiteRT 등 실행 방식과 로컬 자료 저장·PDF 뷰어·검수 UI를 별도로 검증한 뒤 동등성 계약에 추가한다.

## References

[1] [Ollama, gemma3n model library](https://ollama.com/library/gemma3n)

[2] [Google AI Edge Gallery](https://developers.google.com/edge/gallery)
