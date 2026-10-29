import { useEffect, useState } from 'react';
import { getOriginalPdf, getDocuments } from '../../api/documents';
import JobPageLayout, { JobPageHeading } from '../../components/job-page-layout';

const PAGE_SIZE = 10;

export default function JobDocumentHistory() {
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(null);
  const requestKey = `${page}:${refresh}`;
  const loading = result?.key !== requestKey;

  useEffect(() => {
    let cancelled = false;
    getDocuments({ page, size: PAGE_SIZE, sort: 'createdAt,desc' })
      .then((data) => {
        if (!Array.isArray(data?.content) || !Number.isInteger(data.totalPages)) {
          throw new Error('문서 이력 응답 형식이 올바르지 않습니다.');
        }
        if (!cancelled) {
          setResult({ key: requestKey, data });
          setLoadError('');
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error.message || '문서 이력을 불러오지 못했습니다.');
          setResult({ key: requestKey, data: null });
        }
      });
    return () => { cancelled = true; };
  }, [page, requestKey]);

  const download = async (document) => {
    setDownloadError('');
    setDownloading(document.documentId);
    let url;
    try {
      const blob = await getOriginalPdf(document.documentId);
      url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.originalName;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      setDownloadError(error.message || '원본을 다운로드하지 못했습니다.');
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloading(null);
    }
  };

  const data = !loading ? result?.data : null;
  return (
    <JobPageLayout title="작성문서 이력" contentClassName="job-management">
      <JobPageHeading title="작성문서 이력" description="로그인한 사용자의 기존 OCR PDF 이력과 원본을 조회합니다." />
      <p className="job-demo-notice" role="status">현재 목록은 제거 예정인 기존 OCR API입니다. 에이전트 실행 연결 후 서버에서 제거할 예정이며, 현장 업무 이력 API가 제공되면 교체합니다. 현재는 기존 OCR 문서 조회·다운로드만 유지합니다.</p>
      <section className="panel job-form">
        <h2>기존 문서 등록</h2>
        <p className="job-help">OCR 없이 원본을 보관하는 API가 제공되지 않아 이 화면의 등록은 비활성화했습니다. PDF OCR 업로드로 대체하지 않습니다.</p>
        <p className="job-help">아래 목록은 documents의 기존 OCR 문서입니다. 현장별 업무 변경 이력(record_history)이나 출력 문서(generated_documents) 목록이 아닙니다.</p>
        <div className="job-form-actions">
          <button type="button" disabled>문서 등록 (API 미지원)</button>
        </div>
      </section>
      <section className="panel job-example" aria-labelledby="document-history-title">
        <div className="site-list-toolbar">
          <h2 id="document-history-title">등록 이력</h2>
          <button className="job-history-refresh" type="button" onClick={() => setRefresh((value) => value + 1)}>새로고침</button>
        </div>
        {loadError && <p className="dashboard-error" role="alert">{loadError}</p>}
        {downloadError && <p className="dashboard-error" role="alert">{downloadError}</p>}
        {loading ? <p role="status">문서 이력을 불러오는 중입니다...</p> : data && (
          data.content.length ? (
            <>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>파일명</th><th>형식</th><th>크기</th><th>등록 일시</th><th>원본</th></tr></thead>
                  <tbody>
                    {data.content.map((document) => (
                      <tr key={document.documentId}>
                        <td>{document.originalName}</td>
                        <td>{document.originalName.split('.').pop().toUpperCase()}</td>
                        <td>{Math.max(0.1, document.fileSize / 1024).toLocaleString('ko-KR', { maximumFractionDigits: 1 })} KB</td>
                        <td>{new Date(document.createdAt).toLocaleString('ko-KR')}</td>
                        <td><button className="job-history-refresh" type="button" disabled={downloading !== null} onClick={() => download(document)}>{downloading === document.documentId ? '다운로드 중...' : '다운로드'}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <nav className="job-history-pagination" aria-label="문서 이력 페이지">
                <button type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>이전</button>
                <span>{page + 1} / {data.totalPages}</span>
                <button type="button" disabled={page + 1 >= data.totalPages} onClick={() => setPage((value) => value + 1)}>다음</button>
              </nav>
            </>
          ) : <p className="job-help">조회할 기존 PDF 문서가 없습니다.</p>
        )}
      </section>
    </JobPageLayout>
  );
}
