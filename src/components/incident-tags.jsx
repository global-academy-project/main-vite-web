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
      else if (next.filter((tag) => tag.axis === axis).length >= 10) {
        setError('축마다 태그를 10개까지만 선택할 수 있습니다.');
        return false;
      }
      next.push({ axis, value, source: 'USER', confidence: null });
    }
    setError('');
    onChange(next);
    return true;
  };
  const addCas = () => {
    const value = cas.trim();
    if (!/^\d{2,7}-\d{2}-\d$/.test(value) || !validCasChecksum(value)) {
      setError('CAS 번호 형식과 체크섬을 확인하세요. 예: 108-88-3');
      return;
    }
    if (!tags.some((tag) => tag.axis === 'SUBSTANCE' && tag.value === value)
      && !toggle('SUBSTANCE', value, true)) return;
    setCas('');
  };
  return (
    <fieldset className="incident-tag-editor" disabled={disabled}>
      <legend>5축 태그 검토</legend>
      <p className="job-help">모르는 축은 미분류로 남겨 두세요. 직접 선택한 값은 사용자 태그로 저장됩니다. 신뢰도는 안전 판정 점수가 아닙니다.</p>
      <div className="incident-tag-axes">
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
      </div>
      <div className="incident-cas-row">
        <label className="incident-cas-input">물질 CAS 번호
          <input value={cas} onChange={(event) => setCas(event.target.value)} placeholder="108-88-3" />
        </label>
        <button type="button" className="job-history-refresh" onClick={addCas}>물질 추가</button>
        {tags.filter((tag) => tag.axis === 'SUBSTANCE').map((tag) => (
          <button type="button" className="job-history-refresh incident-cas-chip" key={tag.value}
            onClick={() => toggle('SUBSTANCE', tag.value, false)}>{tag.value} 삭제</button>
        ))}
      </div>
      {error && <p role="alert" className="dashboard-error">{error}</p>}
      <details className="incident-tag-summary">
        <summary>고른 태그와 출처 보기 (사용자 / AI 신뢰도)</summary>
        <TagChips tags={tags} codes={codes} />
      </details>
    </fieldset>
  );
}

export function RelatedEvidenceList({ result, codes, onOpen }) {
  if (!result) return null;
  const results = Array.isArray(result) ? result : [];
  return (
    <section className="panel job-example" aria-label="관련 아차사고 검색 결과">
      <h2>관련 아차사고</h2>
      <p className="job-help">선택 현장 안에서 태그 조건과 제목·내용을 검색한 결과입니다. 최신 발생 순으로 표시합니다.</p>
      {!results.length && <p>조건과 일치하는 보고가 없습니다. 태그를 해제하거나 검색어를 바꿔 주세요.</p>}
      {results.map((item) => (
        <article className="incident-evidence" key={item.nearMissId}>
          <h3><button type="button" className="job-history-refresh" onClick={() => onOpen(item.nearMissId)}>{item.title}</button></h3>
          <p>{item.description}</p>
          {item.immediateAction && <p>당시 조치: {item.immediateAction}</p>}
          <small>아차사고 #{item.nearMissId}{item.zoneName && ` · ${item.zoneName}`} · {item.occurredAt}</small>
          <TagChips tags={item.tags} codes={codes} />
        </article>
      ))}
    </section>
  );
}

function validCasChecksum(value) {
  const digits = value.replaceAll('-', '');
  const expected = Number(digits.at(-1));
  let sum = 0;
  for (let index = digits.length - 2, weight = 1; index >= 0; index -= 1, weight += 1) {
    sum += Number(digits[index]) * weight;
  }
  return sum % 10 === expected;
}
