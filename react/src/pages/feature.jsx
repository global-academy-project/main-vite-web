import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteDocument, getDocuments } from "../api/documents";
import { ApiError, clearToken } from "../api/client";
import FeatureHeader from "../components/feature-header";
import "../style/feature-style.css";

const PAGE_SIZE = 10;

function getErrorMessage(error) {
  if (error instanceof ApiError && error.code === "DOCUMENT_NOT_FOUND") {
    return "문서를 찾을 수 없습니다.";
  }
  if (error instanceof ApiError && (error.status === 500 || error.status === 502)) {
    return "잠시 후 다시 시도해 주세요.";
  }
  return error.message || "요청을 처리하지 못했습니다.";
}

function formatSize(size) {
  if (size == null) return "-";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ko-KR");
}

function Feature() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loadedKey, setLoadedKey] = useState("");
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [deletingId, setDeletingId] = useState(null);
  const requestKey = `${page}:${refreshKey}`;
  const loading = loadedKey !== requestKey;
  const error = actionError || (loadError?.key === requestKey ? loadError.message : "");

  const refresh = useCallback(() => setRefreshKey((current) => current + 1), []);

  useEffect(() => {
    let cancelled = false;
    getDocuments({ page, size: PAGE_SIZE, sort: "createdAt,desc" })
      .then((result) => {
        if (cancelled) return;
        const rows = Array.isArray(result)
          ? result
          : result?.content ?? result?.documents ?? result?.items ?? [];
        setDocuments(rows);
        setTotalPages(result?.totalPages ?? 0);
        setHasNext(result?.hasNext ?? page + 1 < (result?.totalPages ?? 0));
        setLoadError(null);
      })
      .catch((requestError) => {
        if (!cancelled) setLoadError({ key: requestKey, message: getErrorMessage(requestError) });
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [page, refreshKey, requestKey]);

  const handleDelete = async (document) => {
    const documentId = document.documentId ?? document.id;
    if (!window.confirm(`"${document.fileName ?? document.title ?? "문서"}"을(를) 삭제할까요?`)) {
      return;
    }
    setDeletingId(documentId);
    setActionError("");
    try {
      await deleteDocument(documentId);
      refresh();
    } catch (requestError) {
      if (requestError.code === "ALREADY_PROCESSING" || requestError.status === 409) {
        setActionError("문서 처리 중에는 삭제할 수 없습니다.");
      } else {
        setActionError(getErrorMessage(requestError));
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="feature-page">
      <FeatureHeader onLogout={() => {
        clearToken();
        navigate("/signin", { replace: true });
      }} />
      <main className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">MY DOCUMENTS</p>
            <h1>내 문서</h1>
            <p className="muted">업로드한 문서의 OCR 처리 상태와 결과를 확인할 수 있습니다.</p>
          </div>
          <button className="primary-button" type="button" onClick={() => navigate("/upload")}>
            새 문서 업로드
          </button>
        </div>

        {error && <p className="notice notice-error" role="alert">{error}</p>}
        {loading ? (
          <p className="empty-state">문서 목록을 불러오는 중입니다...</p>
        ) : documents.length === 0 ? (
          <section className="empty-state">
            <h2>아직 업로드한 문서가 없습니다</h2>
            <p>PDF를 업로드하면 여기에서 처리 상태와 결과를 확인할 수 있습니다.</p>
            <button className="primary-button" type="button" onClick={() => navigate("/upload")}>
              첫 문서 업로드
            </button>
          </section>
        ) : (
          <div className="table-wrap">
            <table className="document-table">
              <thead>
                <tr>
                  <th>파일명</th>
                  <th>크기</th>
                  <th>페이지</th>
                  <th>상태</th>
                  <th>업로드 시각</th>
                  <th><span className="sr-only">문서 작업</span></th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => {
                  const documentId = document.documentId ?? document.id;
                  return (
                    <tr key={documentId}>
                      <td>
                        <button className="document-name" type="button" onClick={() => navigate(`/documents/${documentId}`)}>
                          {document.originalName ?? document.fileName ?? document.title ?? `문서 ${documentId}`}
                        </button>
                      </td>
                      <td>{formatSize(document.fileSize ?? document.fileSizeBytes ?? document.size)}</td>
                      <td>{document.pageCount ?? (Array.isArray(document.pages) ? document.pages.length : document.pages) ?? "-"}</td>
                      <td><span className={`status-badge status-${String(document.status).toLowerCase()}`}>{document.status}</span></td>
                      <td>{formatDate(document.createdAt ?? document.uploadedAt)}</td>
                      <td className="row-actions">
                        <button type="button" onClick={() => navigate(`/documents/${documentId}`)}>결과 보기</button>
                        <button
                          type="button"
                          className="danger-link"
                          disabled={document.status === "PROCESSING" || deletingId === documentId}
                          onClick={() => handleDelete(document)}
                        >
                          {deletingId === documentId ? "삭제 중..." : "삭제"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && documents.length > 0 && (
          <nav className="pagination" aria-label="문서 페이지 이동">
            <button type="button" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>이전</button>
            <span>{page + 1}{totalPages ? ` / ${totalPages}` : ""}</span>
            <button type="button" disabled={!hasNext} onClick={() => setPage((current) => current + 1)}>다음</button>
          </nav>
        )}
      </main>
    </div>
  );
}

export default Feature;

/* 생성한 파일
- feature.jsx: 문서 관리 페이지를 구현하는 React 컴포넌트
- 다른 파일들과의 관계 
- api/documents.js: 문서 목록 조회 및 삭제를 위한 API 호출 함수를 import하여 사용
- api/client.js: API 호출 및 토큰 관리를 위한 함수들을 import하여 사용
- components/feature-header.jsx: 페이지 상단의 헤더 컴포넌트를 import하여 사용
- style/feature-style.css: 문서 관리 페이지의 스타일을 정의하는 CSS 파일을 import하여 적용
*/
