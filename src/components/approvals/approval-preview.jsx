import { measurementFields, permitFormFields } from '../../api/jobs';
import { Badge } from '../home/panel.jsx';
import Icon from '../ui/icon.jsx';
import { shortDateTime, unitLabel } from '../../utils/approval-model.js';
import { RISK_LEVEL_LABELS, timeRange, WORK_TYPE_LABELS } from '../../utils/home-model.js';

const PERMIT_TYPE = { HOT: '화기', CONFINED: '밀폐공간', HEIGHT: '고소' };
const LEVEL_TONE = { HIGH: 'block', MEDIUM: 'warn', LOW: 'neutral' };

/**
 * 결재 문서 미리보기 (GET /approvals/{id}/preview). content 는 문서 상세 응답 그대로라
 * 허가서·위험성평가·TBM 은 사람이 읽는 모양으로, 나머지는 항목 목록으로 보여 준다.
 * 정식 문서가 아니면 markText 를 띠로 표시한다.
 */
export default function ApprovalPreview({ preview }) {
  const content = preview.content ?? {};
  const work = preview.work;
  return (
    <div className="appr-preview">
      {!preview.official && preview.markText && <p className="appr-preview__mark" role="note"><Icon name="info" size={14} />{preview.markText}</p>}
      {work && (
        <dl className="appr-facts">
          <div><dt>작업</dt><dd>{work.title}</dd></div>
          <div><dt>종류</dt><dd>{WORK_TYPE_LABELS[work.workType] ?? work.workType}{work.highRisk ? ' · 고위험' : ''}</dd></div>
          <div><dt>일시</dt><dd>{work.workDate} {timeRange(work.startAt, work.endAt)}</dd></div>
          <div><dt>인원</dt><dd>{work.workerCount ?? '-'}명</dd></div>
        </dl>
      )}
      {preview.targetType === 'PERMIT' && <PermitPreview permit={content} />}
      {preview.targetType === 'RISK' && <RiskPreview risk={content} />}
      {preview.targetType === 'TBM' && <TbmPreview tbm={content} />}
      {!['PERMIT', 'RISK', 'TBM'].includes(preview.targetType) && <GenericPreview content={content} />}
    </div>
  );
}

function PermitPreview({ permit }) {
  const type = permit.permitType;
  const fields = measurementFields[type] ?? [];
  const form = permit.form ?? {};
  const checks = permitFormFields[type]?.checks ?? [];
  const choices = permitFormFields[type]?.choices ?? [];
  const latest = {};
  [...(permit.measurements ?? [])].sort((a, b) => String(a.measuredAt).localeCompare(String(b.measuredAt))).forEach((m) => { latest[m.item] = m; });
  const evaluation = permit.lastEvaluation;
  return (
    <>
      <dl className="appr-facts">
        <div><dt>허가 번호</dt><dd>{permit.permitNo || `#${permit.permitId}`} · {PERMIT_TYPE[type] ?? type}</dd></div>
        <div><dt>유효 시간</dt><dd>{shortDateTime(permit.validFrom)} ~ {shortDateTime(permit.validTo)}</dd></div>
        <div><dt>감시인</dt><dd>{permit.watcherName || '-'}</dd></div>
        <div><dt>관리감독자</dt><dd>{permit.supervisorName || '-'}</dd></div>
      </dl>
      {evaluation && (
        <div className={`appr-eval appr-eval--${evaluation.result === 'BLOCK' ? 'block' : evaluation.result === 'WARN' ? 'warn' : 'done'}`}>
          <strong><Icon name={evaluation.result === 'PASS' ? 'check' : 'alert'} size={16} />최근 규칙 판정: {({ PASS: '통과', WARN: '주의', BLOCK: '차단' })[evaluation.result]}</strong>
          {evaluation.violations?.length > 0 && <ul>{evaluation.violations.map((item, index) => <li key={`${item.ruleCode}-${index}`}>{item.message}{item.legalBasis && <small> · {item.legalBasis}</small>}</li>)}</ul>}
        </div>
      )}
      {fields.length > 0 && (
        <>
          <h4 className="appr-sub">가스 측정</h4>
          <table className="appr-table">
            <thead><tr><th scope="col">항목</th><th scope="col">값</th><th scope="col">측정</th></tr></thead>
            <tbody>
              {fields.map(({ code, label }) => {
                const m = latest[code];
                return <tr key={code}><td>{label}</td><td className="appr-num">{m ? `${m.value} ${unitLabel(m.unit)}`.trim() : <span className="appr-missing">미입력</span>}</td><td>{m ? [shortDateTime(m.measuredAt), m.measurerName, m.remeasure ? '재측정' : ''].filter(Boolean).join(' · ') : '-'}</td></tr>;
              })}
            </tbody>
          </table>
        </>
      )}
      {(checks.length > 0 || choices.length > 0) && (
        <>
          <h4 className="appr-sub">확인 항목</h4>
          <ul className="appr-checks">
            {checks.map(({ code, label }) => {
              const value = form[code];
              const state = value === true ? 'yes' : value === false ? 'no' : 'none';
              return <li key={code} className={`appr-check appr-check--${state}`}><Icon name={state === 'yes' ? 'check' : 'alert'} size={14} />{label}<span>{state === 'yes' ? '확인' : state === 'no' ? '미조치' : '미확인'}</span></li>;
            })}
            {choices.map(({ code, label, options }) => {
              const picked = options.find((option) => option.value === form[code]);
              return <li key={code} className={`appr-check appr-check--${picked ? 'yes' : 'none'}`}><Icon name={picked ? 'check' : 'alert'} size={14} />{label}<span>{picked?.label ?? '미선택'}</span></li>;
            })}
          </ul>
        </>
      )}
    </>
  );
}

function RiskPreview({ risk }) {
  const items = risk.items ?? [];
  return (
    <>
      <h4 className="appr-sub">위험요인 {items.length}개</h4>
      {items.length ? (
        <table className="appr-table">
          <thead><tr><th scope="col">작업 단계 · 위험요인</th><th scope="col">위험도</th><th scope="col">감소대책</th><th scope="col">잔여</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.seq}>
                <td><strong>{item.hazard}</strong><small>{[item.workStep, item.accidentType].filter(Boolean).join(' · ')}</small></td>
                <td className="appr-num">{item.frequency}×{item.severity}={item.riskScore} {item.riskLevel && <Badge tone={LEVEL_TONE[item.riskLevel] ?? 'neutral'}>{RISK_LEVEL_LABELS[item.riskLevel] ?? item.riskLevel}</Badge>}</td>
                <td>{item.controls || <span className="appr-missing">없음</span>}</td>
                <td className="appr-num">{item.residualScore ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="appr-missing">위험요인이 없습니다.</p>}
    </>
  );
}

function TbmPreview({ tbm }) {
  return (
    <>
      <dl className="appr-facts">
        <div><dt>날짜</dt><dd>{tbm.tbmDate}{tbm.heldAt ? ` · ${shortDateTime(tbm.heldAt).slice(6)}` : ''}</dd></div>
        <div><dt>진행</dt><dd>{tbm.leaderName || '-'}</dd></div>
        <div><dt>팀 · 구역</dt><dd>{[tbm.teamName, tbm.zoneName].filter(Boolean).join(' · ') || '-'}</dd></div>
        <div><dt>참석</dt><dd>{tbm.attendees?.length ?? tbm.attendeeCount ?? 0}명</dd></div>
      </dl>
      {tbm.points?.length > 0 && <><h4 className="appr-sub">교육 요점</h4><ol className="appr-points">{tbm.points.map((point, index) => <li key={index}>{point}</li>)}</ol></>}
      {tbm.attendees?.length > 0 && (
        <>
          <h4 className="appr-sub">참석자</h4>
          <ul className="appr-people">{tbm.attendees.map((person) => <li key={person.workerId}>{person.name}{person.healthOk === false && <Badge tone="warn">건강 이상</Badge>}</li>)}</ul>
        </>
      )}
      {tbm.healthCheck && <p className="appr-note">건강 확인: {tbm.healthCheck}</p>}
    </>
  );
}

function GenericPreview({ content }) {
  const entries = Object.entries(content).filter(([, value]) => value != null && value !== '');
  if (!entries.length) return <p className="appr-missing">미리볼 내용이 없습니다.</p>;
  return (
    <dl className="appr-facts appr-facts--list">
      {entries.map(([key, value]) => (
        <div key={key}><dt>{key}</dt><dd>{typeof value === 'object' ? <pre>{JSON.stringify(value, null, 2)}</pre> : String(value)}</dd></div>
      ))}
    </dl>
  );
}
