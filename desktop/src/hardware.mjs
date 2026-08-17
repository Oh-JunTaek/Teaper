import os from "node:os";
import { execFile } from "node:child_process";

function command(command, args) { return new Promise(resolve => execFile(command, args, { timeout: 3000 }, (error, stdout) => resolve(error ? null : stdout.trim()))); }
function vramGb(rows) { return rows.reduce((total, row) => total + (Number(row.match(/([\d.]+)\s*MiB/i)?.[1] || 0) / 1024), 0); }
export async function inspectHardware() {
  const nvidia = await command("nvidia-smi", ["--query-gpu=name,memory.total", "--format=csv,noheader"]);
  const gpu = nvidia ? nvidia.split("\n").map(row => row.trim()) : [];
  const vram = Number(vramGb(gpu).toFixed(1));
  return {
    platform: `${os.platform()} ${os.release()}`,
    cpu: { model: os.cpus()[0]?.model || "unknown", logicalCores: os.cpus().length },
    memoryGb: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
    gpu,
    vramGb: vram,
    suitability: [
      { profile: "3B 이하 양자화", recommended: os.totalmem() / 1024 ** 3 >= 8, note: "8GB 이상 메모리 권장" },
      { profile: "7B 양자화", recommended: vram >= 6 || os.totalmem() / 1024 ** 3 >= 16, note: "GPU VRAM 6GB 또는 시스템 메모리 16GB 이상 권장" },
      { profile: "14B 양자화", recommended: vram >= 10 || os.totalmem() / 1024 ** 3 >= 32, note: "GPU VRAM 10GB 또는 시스템 메모리 32GB 이상 권장" },
    ],
    recommendation: nvidia ? "모델 카드의 실제 메모리 요구량을 이 결과와 함께 확인하세요." : "GPU가 감지되지 않았습니다. CPU에서는 소형 양자화 모델부터 시작하세요.",
  };
}
