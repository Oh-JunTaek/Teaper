
## 로컬 AI 조사 메모

- Ollama 공식 GPU 문서에 따르면 NVIDIA는 Compute Capability 5.0 이상을 지원하며 드라이버 조건이 필요하다. AMD는 ROCm/Vulkan 경로를 사용하고, Apple GPU는 Metal 경로를 사용한다. 출처: https://docs.ollama.com/gpu
- Ollama Windows 공식 문서는 Windows 10 22H2 이상, NVIDIA 551.61 이상 드라이버 또는 AMD ROCm/Vulkan 환경을 제시한다. Ollama API는 기본적으로 localhost:11434에서 제공된다. 실행 파일에는 최소 4GB 공간이 필요하고 모델은 수십~수백 GB가 될 수 있으므로 모델 저장 위치를 별도 지정할 수 있다. 출처: https://docs.ollama.com/windows
- 제품은 CPU/GPU/VRAM/RAM/디스크를 진단한 뒤 모델 등급을 추천하되, 모델 설치 전 라이선스와 모델별 배포 조건을 별도로 확인해야 한다.

- PaddleOCR 공식 문서는 PP-StructureV3가 복잡한 PDF·문서 이미지를 Markdown/JSON으로 구조 보존 변환할 수 있다고 설명하며, PaddleOCR-VL 계열과 PP-OCR 계열을 로컬 문서 처리에 사용할 수 있다고 안내한다. 버전별 API 호환성은 확인해야 한다. 출처: https://paddlepaddle.github.io/PaddleOCR/main/en/index.html
- Qwen3-8B 공식 Hugging Face 모델 카드는 8.2B 파라미터, 32,768 기본 컨텍스트, 로컬 실행 도구로 Ollama·LM Studio·MLX-LM·llama.cpp 등을 지원한다고 설명한다. 모델 카드의 라이선스·배포 조건은 실제 배포 전 원문을 별도로 확인해야 한다. 출처: https://huggingface.co/Qwen/Qwen3-8B
- Gemma 3 4B 공식 모델 카드는 텍스트·이미지 입력을 지원하고 노트북·데스크톱 배포를 목표로 하지만, Hugging Face에서 Google 사용 조건에 동의해야 파일 접근이 가능하다고 명시한다. 따라서 ‘무료 다운로드 가능’과 ‘상업적 재배포 가능’은 같은 의미가 아니다. 출처: https://huggingface.co/google/gemma-3-4b-it
