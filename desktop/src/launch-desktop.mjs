import { spawn } from "node:child_process";
import { createRequire } from "node:module";

// package.json의 POSIX 전용 `KEY=value command` 문법을 피하고 Electron에만 local-only 모드를 전달합니다.
const require = createRequire(import.meta.url);
const electronBinary = require("electron");
const child = spawn(electronBinary, ["src/shell.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, LOCAL_APP_MODE: "true" },
  stdio: "inherit",
  windowsHide: false,
});
child.once("error", error => { console.error("로컬 앱을 시작하지 못했습니다:", error.message); process.exitCode = 1; });
child.once("exit", code => { process.exitCode = code ?? 0; });
