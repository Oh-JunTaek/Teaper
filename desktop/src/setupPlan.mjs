/**
 * 교사용 설치 화면이 사용할 로컬 AI 준비 계획입니다.
 * 설치를 자동 실행하지 않고, 사용자가 다운로드·모델 저장 위치·라이선스를 확인한 뒤 명시적으로 진행하게 합니다.
 */
export const OLLAMA_WINDOWS_DOWNLOAD = "https://ollama.com/download/windows";

export function ollamaInstallPlan(platform = process.platform) {
  if (platform === "win32") return {
    supported: true,
    runtime: "ollama",
    title: "Ollama 설치 파일로 준비하기",
    downloadUrl: OLLAMA_WINDOWS_DOWNLOAD,
    steps: ["OllamaSetup.exe를 내려받아 실행합니다.", "설치가 끝나면 교사도우미를 다시 열어 ‘설치 확인’을 누릅니다.", "모델 저장 위치가 부족하면 설치 전에 다른 드라이브를 선택합니다."],
    note: "명령 프롬프트 입력은 기본 경로가 아닙니다. 설치 파일 방식이 실패할 때만 고급 지원 절차로 안내합니다.",
  };
  if (platform === "darwin") return { supported: true, runtime: "ollama", title: "Ollama 설치 파일로 준비하기", downloadUrl: "https://ollama.com/download", steps: ["macOS용 Ollama를 내려받아 설치합니다.", "교사도우미를 다시 열어 설치 상태를 확인합니다."], note: "초기 파일럿은 Windows 중심으로 지원합니다." };
  return { supported: false, runtime: "ollama", title: "지원 환경 확인 필요", downloadUrl: "https://ollama.com/download", steps: ["운영체제와 하드웨어 정보를 운영자에게 전달해 주세요."], note: "초기 파일럿은 Windows 10 22H2 이상을 기본 지원 환경으로 합니다." };
}

export function recommendLocalModels(hardware) {
  const memory = Number(hardware.memoryGb || 0); const vram = Number(hardware.vramGb || 0);
  if (vram >= 10 || memory >= 32) return { tier: "권장", model: "qwen3:14b", downloadSize: "상당한 저장공간 필요", reason: "복잡한 근거 종합과 해설 품질을 우선하는 PC", alternatives: ["qwen3:8b", "qwen3:4b"] };
  if (vram >= 6 || memory >= 16) return { tier: "표준", model: "qwen3:8b", downloadSize: "중간 저장공간 필요", reason: "일반적인 교사 PC에서 품질과 속도의 균형", alternatives: ["qwen3:4b"] };
  if (memory >= 12) return { tier: "경량", model: "gemma3n:e4b", downloadSize: "상대적으로 적은 저장공간 필요", reason: "저사양 PC에서 Gemma 경량 모델을 우선하는 경우", alternatives: ["qwen3:4b", "gemma3n:e2b"] };
  if (memory >= 8) return { tier: "초경량", model: "gemma3n:e2b", downloadSize: "작은 저장공간 필요", reason: "저사양 PC 또는 향후 모바일 실행 가능성을 확인하는 시작 모델", alternatives: ["qwen3:4b"] };
  return { tier: "보류", model: null, downloadSize: "", reason: "시스템 메모리 8GB 미만에서는 안정적인 문항 생성이 어렵습니다.", alternatives: [] };
}

export function isAllowedRecommendedModel(model) {
  return ["gemma3n:e2b", "gemma3n:e4b", "qwen3:4b", "qwen3:8b", "qwen3:14b"].includes(model);
}
