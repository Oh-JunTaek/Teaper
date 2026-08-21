import { contextBridge, ipcRenderer } from "electron";

// 렌더러에는 교사용 작업에 필요한 좁은 명령만 노출합니다. Node·파일시스템·임의 네트워크 권한은 직접 노출하지 않습니다.
contextBridge.exposeInMainWorld("teacherLocal", {
  getStatus: () => ipcRenderer.invoke("local:status"),
  pullModel: model => ipcRenderer.invoke("local:pull-model", model),
  listMaterials: () => ipcRenderer.invoke("local:list-materials"),
  saveMaterial: input => ipcRenderer.invoke("local:save-material", input),
  deleteMaterial: id => ipcRenderer.invoke("local:delete-material", id),
  listReferences: input => ipcRenderer.invoke("local:list-references", input),
  saveReference: input => ipcRenderer.invoke("local:save-reference", input),
  generateQuestion: input => ipcRenderer.invoke("local:generate-question", input),
  listQuestions: status => ipcRenderer.invoke("local:list-questions", status),
  reviewQuestion: input => ipcRenderer.invoke("local:review-question", input),
  exportApproved: input => ipcRenderer.invoke("local:export-approved", input),
});
