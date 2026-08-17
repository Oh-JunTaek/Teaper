import { createLocalBridge } from "./bridge.mjs";

if (process.env.LOCAL_APP_MODE !== "true") throw new Error("이 프로그램은 LOCAL_APP_MODE=true에서만 실행됩니다.");
const bridge = await createLocalBridge();
console.log(JSON.stringify({ localOnly: true, bridgeUrl: `http://127.0.0.1:${bridge.port}`, sessionToken: bridge.token }));
const close = () => bridge.server.close(() => process.exit(0));
process.once("SIGINT", close); process.once("SIGTERM", close);
