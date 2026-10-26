import { api } from "./client";

function normalizeDocumentId(documentId) {
  const value = String(documentId ?? "").trim();
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new Error("유효한 문서 ID가 필요합니다.");
  }
  return value;
}

const documentPath = (documentId) => `/api/v1/documents/${normalizeDocumentId(documentId)}`;
const runPath = (documentId, runId) => `${documentPath(documentId)}/runs/${runId}`;

export function uploadDocument(file, { engine, extractImages } = {}) {
  const body = new FormData();
  body.append("file", file);
  if (engine) body.append("engine", engine);
  if (extractImages !== undefined) body.append("extractImages", String(extractImages));

  return api("/api/v1/documents", { method: "POST", body });
}

export function getDocuments({ page, size, sort, status } = {}) {
  const query = new URLSearchParams();
  if (page !== undefined) query.set("page", String(page));
  if (size !== undefined) query.set("size", String(size));
  if (sort) query.set("sort", sort);
  if (status) query.set("status", status);
  const suffix = query.size ? `?${query.toString()}` : "";
  return api(`/api/v1/documents${suffix}`);
}

export function getDocument(documentId) {
  return api(documentPath(documentId));
}

export function deleteDocument(documentId) {
  return api(documentPath(documentId), { method: "DELETE" });
}

export function getOriginalPdf(documentId) {
  return api(`${documentPath(documentId)}/file`, { responseType: "blob" });
}

export function getDocumentRuns(documentId) {
  return api(`${documentPath(documentId)}/runs`);
}

export function getDocumentRun(documentId, runId) {
  return api(runPath(documentId, runId));
}

export function reprocessDocument(documentId, { engine, extractImages } = {}) {
  return api(`${documentPath(documentId)}/reprocess`, {
    method: "POST",
    body: {
      ...(engine ? { engine } : {}),
      ...(extractImages !== undefined ? { extractImages } : {}),
    },
  });
}

export function exportRun(documentId, runId, format = "txt") {
  return api(`${runPath(documentId, runId)}/export?format=${format}`, {
    responseType: "response",
  });
}

export function getExtractedImage(documentId, runId, imageId) {
  return api(`${runPath(documentId, runId)}/images/${imageId}`, { responseType: "blob" });
}

/* 생성한 파일
- documents.js: 문서 업로드, 조회, 삭제, 재처리 등 문서 관련 API 요청을 처리하는 함수들을 제공
- uploadDocument: 문서를 업로드하는 함수
- getDocuments: 문서 목록을 조회하는 함수
- getDocument: 특정 문서를 조회하는 함수
- deleteDocument: 특정 문서를 삭제하는 함수
- getOriginalPdf: 원본 PDF 파일을 다운로드하는 함수
- getDocumentRuns: 특정 문서의 처리 결과(run) 목록을 조회하는 함수
- getDocumentRun: 특정 문서의 특정 처리 결과(run)를 조회하는 함수
- reprocessDocument: 특정 문서를 재처리하는 함수
- exportRun: 특정 처리 결과(run)를 지정한 형식으로 내보내는 함수
- getExtractedImage: 특정 처리 결과(run)에서 추출된 이미지를 다운로드하는 함수
- 다른 파일들과의 관계
- client.js: api 함수를 사용하여 API 요청을 수행
*/
