import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  deleteDocument,
  exportRun,
  getDocument,
  getDocumentRun,
  getDocumentRuns,
  getExtractedImage,
  getOriginalPdf,
} from "../../api/documents";
import { ApiError, clearToken } from "../../api/client";
import FeatureHeader from "../../components/feature-header";
import "../../style/feature-style.css";

const POLL_INTERVAL_MS = 2500;
const POLL_LIMIT_MS = 12 * 60 * 1000;
const PROCESSING_STATES = new Set(["PROCESSING", "UPLOADED"]);

function getErrorMessage(error) {
  if (error instanceof ApiError && error.code === "DOCUMENT_NOT_FOUND") {
    return "문서를 찾을 수 없습니다.";
  }
  if (error instanceof ApiError && (error.status === 500 || error.status === 502)) {
    return "잠시 후 다시 시도해 주세요.";
  }
  return error.message || "요청을 처리하지 못했습니다.";
}

function formatConfidence(value) {
  if (value == null) return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return `${Math.round(number <= 1 ? number * 100 : number)}%`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ko-KR");
}

function getRunId(run) {
  return run?.runId ?? run?.id;
}

function getFilename(response, originalName, engine, format) {
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  }
  const quoted = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  if (quoted) return quoted;
  const baseName = (originalName ?? "document").replace(/\.pdf$/i, "");
  return `${baseName}_${engine ?? "ocr"}.${format}`;
}

async function downloadExport(document, run, format) {
  const response = await exportRun(document.documentId ?? document.id, getRunId(run), format);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = getFilename(response, document.originalName ?? document.fileName, run.engine, format);
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function DocumentDetail() {
  const { documentId, runId: routeRunId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const requestedRunId = routeRunId ?? location.state?.runId ?? null;
  const [documentAsset, setDocumentAsset] = useState(null);
  const [runAsset, setRunAsset] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loadedKey, setLoadedKey] = useState("");
  const [pollingExpiredKey, setPollingExpiredKey] = useState("");
  const [error, setError] = useState("");
  const [pdfAsset, setPdfAsset] = useState(null);
  const [imageAsset, setImageAsset] = useState(null);
  const [pageSelection, setPageSelection] = useState({ documentId: null, runId: null, index: 0 });
  const [busy, setBusy] = useState(false);
  const requestKey = `${documentId}:${requestedRunId ?? "latest"}`;
  const document = documentAsset?.documentId === documentId ? documentAsset.data : null;
  const run = runAsset?.requestKey === requestKey ? runAsset.data : null;
  const loading = loadedKey !== requestKey;
  const pollingExpired = pollingExpiredKey === requestKey;
  const activeRunId = getRunId(run);
  const currentPage = pageSelection.documentId === documentId && pageSelection.runId === activeRunId
    ? pageSelection.index
    : 0;
  const pdfUrl = pdfAsset?.documentId === documentId ? pdfAsset.url : "";
  const imageUrls = imageAsset?.documentId === documentId && imageAsset.runId === activeRunId
    ? imageAsset.images
    : [];

  useEffect(() => {
    let cancelled = false;
    let timer;
    const deadline = Date.now() + POLL_LIMIT_MS;

    const load = async () => {
      try {
        const payload = await getDocument(documentId);
        const nextDocument = payload?.document ?? payload;
        if (cancelled) return;
        setDocumentAsset({ documentId, data: nextDocument });

        let nextRun = nextDocument?.latestRun ?? null;
        if (requestedRunId && requestedRunId !== getRunId(nextRun)) {
          nextRun = await getDocumentRun(documentId, requestedRunId);
        } else if (requestedRunId && !nextRun) {
          nextRun = await getDocumentRun(documentId, requestedRunId);
        }
        if (cancelled) return;
        setRunAsset({ requestKey, data: nextRun });
        setLoadedKey(requestKey);
        setError("");

        const status = nextRun?.status ?? nextDocument?.status;
        if (PROCESSING_STATES.has(status)) {
          if (Date.now() >= deadline) {
            setPollingExpiredKey(requestKey);
            return;
          }
          timer = window.setTimeout(load, POLL_INTERVAL_MS);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(getErrorMessage(requestError));
          setLoadedKey(requestKey);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [documentId, requestedRunId, requestKey]);

  useEffect(() => {
    if (!documentId) return undefined;
    let cancelled = false;
    let objectUrl;
    getOriginalPdf(documentId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfAsset({ documentId, url: objectUrl });
      })
      .catch((requestError) => {
        if (!cancelled) setError(getErrorMessage(requestError));
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId]);

  useEffect(() => {
    const activeRunId = getRunId(run);
    const imageList = run?.images ?? [];
    if (!activeRunId || imageList.length === 0) return undefined;
    let cancelled = false;
    const createdUrls = [];
    Promise.all(imageList.map(async (image) => {
      const imageId = image.imageId ?? image.id;
      const blob = await getExtractedImage(documentId, activeRunId, imageId);
      const url = URL.createObjectURL(blob);
      createdUrls.push(url);
      return { ...image, blobUrl: url };
    }))
      .then((results) => {
        if (!cancelled) setImageAsset({ documentId, runId: activeRunId, images: results });
      })
      .catch((requestError) => {
        if (!cancelled) setError(getErrorMessage(requestError));
      });
    return () => {
      cancelled = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [documentId, run]);

  useEffect(() => {
    let cancelled = false;
    getDocumentRuns(documentId)
      .then((payload) => {
        if (cancelled) return;
        setRuns(Array.isArray(payload) ? payload : payload?.runs ?? payload?.content ?? []);
      })
      .catch((requestError) => {
        if (!cancelled) setError(getErrorMessage(requestError));
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, run?.status]);

  const pages = useMemo(() => run?.pages ?? [], [run]);
  const activePage = pages[currentPage] ?? null;
  const status = run?.status ?? document?.status ?? "PROCESSING";
  const processing = PROCESSING_STATES.has(status);
  const documentProcessing = PROCESSING_STATES.has(document?.status);
  const completed = status === "DONE";

  const handleReprocessOpen = () => {
    navigate("/upload", {
      state: {
        reprocess: {
          documentId,
          fileName: document?.originalName ?? document?.fileName ?? document?.title ?? `문서 ${documentId}`,
          extractImages: Boolean(run?.extractImages),
        },
      },
    });
  };

  const handleDelete = async () => {
    const currentDocumentId = document?.documentId ?? document?.id;
    if (!currentDocumentId || String(currentDocumentId) !== String(documentId)) {
      setError("현재 문서 정보를 확인할 수 없어 삭제하지 않았습니다.");
      return;
    }
    const currentDocumentName = document.originalName ?? document.fileName ?? document.title ?? `문서 ${currentDocumentId}`;
    if (documentProcessing || !window.confirm(`“${currentDocumentName}” 문서만 삭제할까요?`)) return;
    setBusy(true);
    setError("");
    try {
      await deleteDocument(currentDocumentId);
      navigate("/feature", { replace: true });
    } catch (requestError) {
      if (requestError.code === "ALREADY_PROCESSING" || requestError.status === 409) {
        setError("문서 처리 중에는 삭제할 수 없습니다.");
      } else {
        setError(getErrorMessage(requestError));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="feature-page">
      <FeatureHeader onLogout={() => {
        clearToken();
        navigate("/signin", { replace: true });
      }} />
      <main className="page-content">
        <button className="back-button" type="button" onClick={() => navigate("/feature")}>← 내 문서</button>
        {loading ? (
          <p className="empty-state">문서를 불러오는 중입니다...</p>
        ) : error && !document ? (
          <p className="notice notice-error" role="alert">{error}</p>
        ) : document && (
          <>
            <div className="page-heading detail-heading">
              <div>
                <p className="eyebrow">DOCUMENT RESULT</p>
                <h1>{document.originalName ?? document.fileName ?? document.title ?? `문서 ${documentId}`}</h1>
                <p className="muted">
                  <span className={`status-badge status-${String(status).toLowerCase()}`}>{status}</span>
                  {run?.engine && <span className="detail-meta">엔진: {run.engine}</span>}
                </p>
              </div>
              <div className="button-row">
                {!documentProcessing && <button type="button" onClick={handleReprocessOpen}>다른 엔진으로 다시 처리</button>}
                <button type="button" className="danger-button" disabled={documentProcessing || busy} onClick={handleDelete}>삭제</button>
              </div>
            </div>

            {error && <p className="notice notice-error" role="alert">{error}</p>}
            {processing && (
              <>
                <section className="processing-panel" aria-live="polite">
                  <span className="loading-indicator" />
                  <div>
                    <strong>문서를 처리하고 있습니다</strong>
                    <p>{pollingExpired ? "처리 상태 확인 시간이 초과되었습니다. 목록에서 나중에 다시 확인해 주세요." : "처리가 완료될 때까지 자동으로 상태를 확인합니다."}</p>
                  </div>
                  <button type="button" onClick={() => window.location.reload()}>다시 확인</button>
                </section>
                <section className="summary-panel summary-panel-loading" aria-live="polite">
                  <span className="summary-skeleton" aria-hidden="true" />
                  <div>
                    <h2>문서 요약</h2>
                    <p>요약을 만드는 중입니다.</p>
                  </div>
                </section>
              </>
            )}
            {status === "FAILED" && (
              <p className="notice notice-error" role="alert">
                {run?.errorMessage ?? run?.latestRun?.errorMessage ?? "문서 처리에 실패했습니다."}
              </p>
            )}

            {completed && (
              <>
                <div className="result-toolbar">
                  <section className="confidence-row">
                    <span>전체 평균 신뢰도 <strong>{formatConfidence(run?.avgConfidence)}</strong></span>
                    <span>페이지 <strong>{pages.length || document.pageCount || "-"}</strong></span>
                  </section>
                  <section className="result-actions">
                    <h2>결과 내려받기</h2>
                    <button type="button" onClick={() => downloadExport(document, run, "txt").catch((e) => setError(getErrorMessage(e)))}>TXT 다운로드</button>
                    <button type="button" onClick={() => downloadExport(document, run, "json").catch((e) => setError(getErrorMessage(e)))}>JSON 다운로드</button>
                  </section>
                </div>
                <section className="result-layout">
                  <div className="pdf-panel">
                    <h2>원본 PDF</h2>
                    {pdfUrl ? (
                      <iframe title="원본 PDF" src={`${pdfUrl}#page=${currentPage + 1}`} />
                    ) : (
                      <p className="muted">원본 PDF를 불러오는 중입니다...</p>
                    )}
                  </div>
                  <div className="text-panel">
                    <div className="panel-heading">
                      <h2>추출 텍스트</h2>
                      <div className="page-controls">
                        <button type="button" disabled={currentPage <= 0} onClick={() => setPageSelection({ documentId, runId: activeRunId, index: currentPage - 1 })}>이전</button>
                        <span>{pages.length ? `${currentPage + 1} / ${pages.length}` : "페이지 -"}</span>
                        <button type="button" disabled={currentPage >= pages.length - 1} onClick={() => setPageSelection({ documentId, runId: activeRunId, index: currentPage + 1 })}>다음</button>
                      </div>
                    </div>
                    {activePage ? (
                      <>
                        <p className="confidence-label">페이지 신뢰도: {formatConfidence(activePage.confidence)}</p>
                        <pre className="page-text">{activePage.text ?? ""}</pre>
                      </>
                    ) : <p className="muted">표시할 페이지 결과가 없습니다.</p>}
                  </div>
                </section>

                <section className="summary-panel result-summary">
                  <h2>문서 요약</h2>
                  {run?.summary?.trim() ? (
                    <p className="summary-text">{run.summary}</p>
                  ) : (
                    <p className="muted">요약이 없습니다.</p>
                  )}
                </section>

                {imageUrls.length > 0 && (
                  <section className="extracted-images">
                    <h2>추출한 이미지</h2>
                    <div className="image-grid">
                      {imageUrls.map((image) => (
                        <figure key={image.imageId ?? image.id}>
                          <img src={image.blobUrl} alt={image.fileName ?? `추출 이미지 ${image.imageId ?? image.id}`} />
                          <figcaption>{image.fileName ?? `페이지 ${image.pageNo ?? "-"}`}</figcaption>
                        </figure>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            <section className="run-history">
              <h2>실행 이력</h2>
              {runs.length === 0 ? <p className="muted">실행 이력이 없습니다.</p> : (
                <ul>
                  {runs.map((item) => {
                    const itemRunId = getRunId(item);
                    return (
                      <li key={itemRunId}>
                        <button type="button" onClick={() => navigate(`/documents/${documentId}/runs/${itemRunId}`)}>
                          <span>{item.engine ?? "OCR"} · {item.status}</span>
                          <time>{formatDate(item.createdAt ?? item.startedAt)}</time>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default DocumentDetail;
