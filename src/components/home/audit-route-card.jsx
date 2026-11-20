import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../ui/icon.jsx';
import { Badge } from './panel.jsx';
import { confirmAction } from '../ui/confirm-store.js';
import { deleteAuditReport, getAuditReport } from '../../api/audit-reports.js';
import { auditCardView, auditReportGenerating } from '../../utils/audit-route-model.js';

// 요약 중일 때 다시 조회하는 간격 (감사 대응 상세 화면과 같다)
const POLL_MS = 5000;

/**
 * 작업 등록 대화의 감사 분기 카드. 서버가 만들었거나 연결한 감사 대응 보고서의 상태를 보여 준다.
 *  - 요약 중이면 5초마다 다시 조회하고, "중지"로 만들고 있는 보고서를 지울 수 있다 (확인 창)
 *  - 요약이 끝나면(초안·검토 필요·요약 실패) 감사 대응 화면으로 이동 버튼. 자동으로 이동하지 않는다
 *  - 대화 문구는 서버가 저장한 답변 메시지를 쓴다 (이 카드는 상태만)
 */
export default function AuditRouteCard({ siteId, reportId }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const generating = auditReportGenerating(report);

  useEffect(() => {
    if (!siteId || !reportId) return undefined;
    let active = true;
    getAuditReport(siteId, reportId)
      .then((data) => { if (active) { setReport(data); setError(''); } })
      .catch((requestError) => {
        if (!active) return;
        if (requestError?.status === 404) setMissing(true);
        else setError(requestError?.message || '감사 대응 보고서 상태를 불러오지 못했습니다.');
      });
    return () => { active = false; };
  }, [siteId, reportId, attempt]);

  useEffect(() => {
    if (!generating || stopped || !siteId || !reportId) return undefined;
    const timer = setInterval(() => {
      getAuditReport(siteId, reportId)
        .then(setReport)
        .catch((requestError) => { if (requestError?.status === 404) setMissing(true); });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [generating, stopped, siteId, reportId]);

  const stop = async () => {
    const confirmed = await confirmAction({
      title: '감사 대응 보고서 만들기를 중지할까요?',
      message: '만들고 있는 감사 대응 보고서를 지웁니다. 지운 보고서는 되돌릴 수 없습니다. 기간이 잘못됐다면 중지한 뒤 다시 요청하세요.',
      confirmLabel: '중지',
      tone: 'warn',
    });
    if (!confirmed) return;
    setStopping(true);
    setError('');
    try {
      await deleteAuditReport(siteId, reportId);
      setStopped(true);
    } catch (requestError) {
      if (requestError?.status === 404) setMissing(true);
      else setError(requestError?.message || '중지하지 못했습니다.');
    } finally {
      setStopping(false);
    }
  };

  const view = auditCardView({ report, stopped, missing });
  return (
    <article className="audit-route-card" aria-label="감사 대응 보고서">
      <header className="audit-route-card__head">
        <span className="audit-route-card__title"><Icon name="records" size={16} />{report?.title || '감사 대응 보고서'}</span>
        {view && <Badge tone={view.tone}>{view.label}</Badge>}
      </header>
      {/* 제목을 사람이 바꿨으면 기간이 안 보일 수 있어 따로 보인다 (기본 제목에는 기간이 들어 있음) */}
      {report && !String(report.title ?? '').includes(String(report.dateFrom)) && <p className="audit-route-card__period">{report.dateFrom} ~ {report.dateTo}</p>}
      {!view && !error && <p className="audit-route-card__note" role="status"><Icon name="spinner" size={14} className="ui-spin" /><span>상태를 확인하고 있습니다.</span></p>}
      {view && <p className="audit-route-card__note">{generating && !stopped && <Icon name="spinner" size={14} className="ui-spin" />}<span>{view.note}</span></p>}
      {error && (
        <p className="audit-route-card__note is-error" role="alert"><Icon name="alert" size={14} /><span>{error}</span>
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => { setError(''); setAttempt((value) => value + 1); }}>다시 조회</button>
        </p>
      )}
      {view && (view.canOpen || view.canStop) && (
        <div className="audit-route-card__actions">
          {view.canStop && <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={stopping} onClick={stop}>{stopping ? '중지하는 중…' : '중지'}</button>}
          {view.canOpen && <Link className="ui-btn ui-btn--primary ui-btn--sm" to={`/audit-reports/${reportId}`}>감사 대응 화면으로 이동</Link>}
        </div>
      )}
    </article>
  );
}
