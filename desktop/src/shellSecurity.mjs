export const LOCAL_WINDOW_WEB_PREFERENCES = Object.freeze({
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
});

export function isAllowedLocalPage(url) {
  return url.startsWith("file:") || url.startsWith("data:text/html") || url === "about:blank";
}

export function externalNavigationMessage(url) {
  return `로컬 앱은 외부 페이지를 직접 열지 않습니다: ${url}`;
}
