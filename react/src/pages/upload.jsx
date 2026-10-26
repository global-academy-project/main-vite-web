import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { reprocessDocument, uploadDocument } from "../api/documents";
import { ApiError, clearToken } from "../api/client";
import { getEngines } from "../api/engines";
import FeatureHeader from "../components/feature-header";
import "../style/feature-style.css";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function normalizeEngines(payload) {
  const rawList = Array.isArray(payload)
    ? payload
    : payload?.engines ?? payload?.items ?? [];
  const list = Array.isArray(rawList)
    ? rawList
    : Object.entries(rawList).map(([engine, value]) => ({ engine, ...value }));
  return {
    engines: Array.isArray(list) ? list : [],
    networkMode: payload?.networkMode ?? "UNKNOWN",
    defaultEngine: payload?.defaultEngine ?? "",
  };
}

function getEngineValue(engine) {
  return engine.name ?? engine.engine ?? engine.code ?? engine.id;
}

function Upload() {
  const navigate = useNavigate();
  const location = useLocation();
  const reprocess = location.state?.reprocess ?? null;
  const [engines, setEngines] = useState([]);
  const [networkMode, setNetworkMode] = useState("UNKNOWN");
  const [engineLoading, setEngineLoading] = useState(true);
  const [selectedEngine, setSelectedEngine] = useState("");
  const [engineError, setEngineError] = useState("");
  const [file, setFile] = useState(null);
  const [extractImages, setExtractImages] = useState(Boolean(reprocess?.extractImages));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getEngines()
      .then((payload) => {
        if (cancelled) return;
        const result = normalizeEngines(payload);
        setEngines(result.engines);
        setNetworkMode(result.networkMode);
        const defaultEngine = result.engines.find((engine) => (
          getEngineValue(engine) === result.defaultEngine && engine.available
        ));
        const initial = getEngineValue(defaultEngine ?? result.engines.find((engine) => engine.available) ?? {});
        if (initial) setSelectedEngine(initial);
      })
      .catch((requestError) => {
        if (!cancelled) setEngineError(requestError.message || "엔진 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setEngineLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFileChange = async (event) => {
    const selected = event.target.files?.[0] ?? null;
    event.target.value = "";
    setFile(null);
    setError("");
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".pdf")) {
      setError("PDF 파일만 업로드할 수 있습니다.");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError("파일은 20MB 이하만 업로드할 수 있습니다.");
      return;
    }
    const signature = await selected.slice(0, 5).text();
    if (!signature.startsWith("%PDF-")) {
      setError("유효한 PDF 파일을 선택해 주세요.");
      return;
    }
    setFile(selected);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if ((!reprocess && !file) || !selectedEngine || uploading) return;
    setUploading(true);
    setError("");
    try {
      const result = reprocess
        ? await reprocessDocument(reprocess.documentId, { engine: selectedEngine, extractImages })
        : await uploadDocument(file, { engine: selectedEngine, extractImages });
      if (!result?.documentId || !result?.runId) {
        throw new Error(`${reprocess ? "재처리" : "업로드"} 응답에 문서 ID 또는 실행 ID가 없습니다.`);
      }
      navigate(`/documents/${result.documentId}/runs/${result.runId}`);
    } catch (requestError) {
      if (requestError instanceof ApiError && (requestError.status === 500 || requestError.status === 502)) {
        setError("잠시 후 다시 시도해 주세요.");
      } else {
        setError(requestError.message || `문서를 ${reprocess ? "재처리" : "업로드"}하지 못했습니다.`);
      }
    } finally {
      setUploading(false);
    }
  };

  const selected = engines.find((engine) => getEngineValue(engine) === selectedEngine);
  const sendsExternally = selected?.external
    || String(getEngineValue(selected ?? {})).toUpperCase() === "OPENAI";

  return (
    <div className="feature-page">
      <FeatureHeader onLogout={() => {
        clearToken();
        navigate("/signin", { replace: true });
      }} />
      <main className="page-content narrow-content">
        <button className="back-button" type="button" onClick={() => navigate(reprocess ? `/documents/${reprocess.documentId}` : "/feature")}>
          ← {reprocess ? "문서 결과" : "내 문서"}
        </button>
        <div className="page-heading">
          <div>
            <p className="eyebrow">{reprocess ? "REPROCESS DOCUMENT" : "NEW OCR JOB"}</p>
            <h1>{reprocess ? "다른 엔진으로 다시 처리" : "문서 업로드"}</h1>
            <p className="muted">
              {reprocess ? `기존 문서 “${reprocess.fileName}”에 사용할 OCR 엔진을 선택해 주세요.` : "PDF를 선택하고 OCR 엔진을 지정해 주세요."}
            </p>
          </div>
          <span className={`network-badge network-${String(networkMode).toLowerCase()}`}>
            네트워크 {networkMode}
          </span>
        </div>

        <form className="upload-panel" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>OCR 엔진</span>
            {engineLoading ? (
              <span className="muted">엔진 목록을 불러오는 중...</span>
            ) : (
              <select
                value={selectedEngine}
                onChange={(event) => setSelectedEngine(event.target.value)}
                required
                disabled={engines.length === 0}
              >
                <option value="" disabled>엔진을 선택하세요</option>
                {engines.map((engine) => {
                  const value = getEngineValue(engine);
                  return (
                    <option key={value} value={value} title={engine.reason} disabled={!engine.available}>
                      {engine.label ?? value}{engine.available ? "" : " · 준비 중"}
                    </option>
                  );
                })}
              </select>
            )}
          </label>
          {engineError && <p className="field-error" role="alert">{engineError}</p>}
          {sendsExternally && (
            <p className="notice notice-warning">문서가 외부로 전송됩니다. OpenAI 엔진 사용 시 문서가 외부로 전송됩니다.</p>
          )}
          {selected?.available === false && selected.reason && (
            <p className="muted">{selected.reason}</p>
          )}

          {reprocess ? (
            <p className="selected-file">기존 문서: {reprocess.fileName}</p>
          ) : (
            <>
              <label className="form-field">
                <span>PDF 파일</span>
                <input type="file" accept="application/pdf,.pdf" onChange={handleFileChange} />
                <small>PDF 형식, 최대 20MB</small>
              </label>
              {file && <p className="selected-file">{file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB</p>}
            </>
          )}

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={extractImages}
              onChange={(event) => setExtractImages(event.target.checked)}
            />
            <span>이미지도 추출</span>
          </label>

          {error && <p className="notice notice-error" role="alert">{error}</p>}
          <button
            className="primary-button full-width"
            type="submit"
            disabled={(!reprocess && !file) || !selectedEngine || engineLoading || uploading}
          >
            {uploading
              ? (reprocess ? "재처리 요청 중..." : "업로드 중...")
              : (reprocess ? "선택한 엔진으로 재처리" : "업로드하고 처리 시작")}
          </button>
        </form>
      </main>
    </div>
  );
}

export default Upload;

/* 생성한 파일
- upload.jsx: 문서 업로드 페이지를 구현하는 React 컴포넌트
- 다른 파일들과의 관계
- api/documents.js: 문서 업로드 및 관련 API 호출을 처리하는 함수들을 import하여 사용
- api/client.js: API 호출 및 토큰 관리를 위한 함수들을 import하여 사용
- components/feature-header.jsx: 페이지 상단의 헤더 컴포넌트를 import하여 사용
- style/feature-style.css: 업로드 페이지의 스타일을 정의하는 CSS 파일을 import하여 적용
*/
