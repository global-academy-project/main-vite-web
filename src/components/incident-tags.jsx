import { useState } from 'react';
import { TAG_AXES, TAG_LABELS } from '../utils/agentic-rag-tags';
import '../style/job/job-search.css';

export function TagChips({ tags, codes = [] }) {
  return (
    <div className="incident-tags">
      {TAG_AXES.map(({ axis, label }) => (
        <div className="incident-tag-axis" key={axis}>
          <span>{label}</span>
          <div className="tag-chip-list">
            {tags.filter((tag) => tag.axis === axis).map((tag) => (
              <span className="tag-chip" key={`${axis}:${tag.value}`}>
                {codes.find((code) => code.axis === axis && code.code === tag.value)?.label
                  ?? TAG_LABELS[axis]?.[tag.value] ?? tag.value}
                <small> · {tag.source === 'USER' ? '사용자' : 'AI'}
                  {tag.confidence != null ? ` ${Math.round(tag.confidence * 100)}%` : ''}
                </small>
              </span>
            ))}
            {!tags.some((tag) => tag.axis === axis) && <span className="tag-unspecified">미분류</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TagEditor({ tags, codes, onChange, disabled = false }) {
  const [cas, setCas] = useState('');
  const [error, setError] = useState('');
  const toggle = (axis, value, checked) => {
    let next = tags.filter((tag) => !(tag.axis === axis && tag.value === value));
    if (checked) {
      if (axis === 'SEVERITY') next = next.filter((tag) => tag.axis !== axis);
      next.push({ axis, value, source: 'USER', confidence: null });
    }
    onChange(next);
  };
  const addCas = () => {
    const value = cas.trim();
    if (!/^\d{2,7}-\d{2}-\d$/.test(value)) {
      setError('CAS 번호 형식으로 입력하세요. 예: 108-88-3');
      return;
    }
    if (!tags.some((tag) => tag.axis === 'SUBSTANCE' && tag.value === value)) toggle('SUBSTANCE', value, true);
    setCas('');
    setError('');
  };
  return (
    <fieldset className="incident-tag-editor" disabled={disabled}>
      <legend>5축 태그 검토</legend>
      <p className="job-help">모르는 축은 미분류로 남겨 두세요. 직접 선택한 값은 사용자 태그로 저장됩니다. 신뢰도는 안전 판정 점수가 아닙니다.</p>
      {TAG_AXES.filter(({ axis }) => axis !== 'SUBSTANCE').map(({ axis, label }) => (
        <fieldset key={axis}>
          <legend>{label}</legend>
          <div className="incident-tag-options">
            {codes.filter((code) => code.axis === axis).map((code) => (
              <label key={code.code}>
                <input type="checkbox" checked={tags.some((tag) => tag.axis === axis && tag.value === code.code)}
                  onChange={(event) => toggle(axis, code.code, event.target.checked)} />
                {code.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <label className="incident-cas-input">물질 CAS 번호
        <input value={cas} onChange={(event) => setCas(event.target.value)} placeholder="108-88-3" />
      </label>
      <button type="button" className="job-history-refresh" onClick={addCas}>물질 추가</button>
      {tags.filter((tag) => tag.axis === 'SUBSTANCE').map((tag) => (
        <button type="button" className="job-history-refresh" key={tag.value}
          onClick={() => toggle('SUBSTANCE', tag.value, false)}>{tag.value} 삭제</button>
      ))}
      {error && <p role="alert" className="dashboard-error">{error}</p>}
      <TagChips tags={tags} codes={codes} />
    </fieldset>
  );
}

export function RelatedEvidenceList({ result, codes, onOpen }) {
  if (!result) return null;
  return (
    <section className="panel job-example" aria-label="관련 아차사고 검색 결과">
      <h2>관련 아차사고</h2>
      <p className="job-help">현장 내 태그·본문 검색입니다. 공공데이터 RAG 검색은 포함하지 않습니다.
        검색 범위: {result.scope} · 시도: {result.attempts.join(' → ')}</p>
      {!result.results.length && <p>조건과 일치하는 보고가 없습니다. 태그를 해제하거나 검색어를 바꿔 주세요.</p>}
      {result.results.map((item) => (
        <article className="incident-evidence" key={item.nearMissId}>
          <h3><button type="button" className="job-history-refresh" onClick={() => onOpen(item.nearMissId)}>{item.title}</button></h3>
          <p>{item.excerpt}</p>
          <small>출처: {item.sourceRef} · {item.occurredAt}</small>
          <TagChips tags={item.tags} codes={codes} />
        </article>
      ))}
    </section>
  );
}
