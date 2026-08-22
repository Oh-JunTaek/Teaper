// Windows·macOS·Linux에서 같은 방식으로 local-only 브리지를 시작합니다.
process.env.LOCAL_APP_MODE = "true";
await import("./main.mjs");
