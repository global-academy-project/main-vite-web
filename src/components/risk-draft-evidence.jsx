import { parseDraftEvidence } from '../utils/risk-evidence.js';

/** 근거 한 건: 종류 · 출처 이름 · 본문 앞부분 (길면 "더 보기"로 펼침). 내부 코드(docId 등)는 보이지 않는다 */
function Citation({ item }) {
  return (
    <li className="risk-evidence__cite">
      <span className="risk-evidence__kind">{item.kind}</span>
      {item.title && <strong className="risk-evidence__source">{item.title}</strong>}
      {item.long ? (
        <details className="risk-evidence__text">
          <summary>
            <span className="risk-evidence__preview">{item.preview}</span>
            <span className="risk-evidence__toggle risk-evidence__toggle--open">더 보기</span>
            <span className="risk-evidence__toggle risk-evidence__toggle--close">접기</span>
          </summary>
          <p>{item.text}</p>
        </details>
      ) : item.text && <p className="risk-evidence__preview">{item.text}</p>}
    </li>
  );
}

/** 위험성평가 "기존 초안 근거·검토 정보". formData를 읽을 수 없으면 예전처럼 원문을 그대로 보여 준다 (읽기만 하고 값은 바꾸지 않는다) */
export default function RiskDraftEvidence({ formData }) {
  const items = parseDraftEvidence(formData);
  return (
    <details className="risk-formdata">
      <summary>기존 초안 근거·검토 정보 (수정해도 그대로 보존)</summary>
      {items ? (
        <ol className="risk-evidence">
          {items.map((item) => (
            <li key={item.seq} className="risk-evidence__item">
              <strong className="risk-evidence__hazard">{item.hazard || '위험요인 없음'}</strong>
              {item.measures.length > 0 && (
                <section>
                  <h4 className="risk-evidence__label">감소대책</h4>
                  <ul className="risk-evidence__list">{item.measures.map((measure, index) => <li key={index}>{measure}</li>)}</ul>
                </section>
              )}
              {item.citations.length + item.moreCitations.length > 0 && (
                <section>
                  <h4 className="risk-evidence__label">근거 {item.citations.length + item.moreCitations.length}건</h4>
                  <ul className="risk-evidence__cites">{item.citations.map((cite, index) => <Citation key={index} item={cite} />)}</ul>
                  {item.moreCitations.length > 0 && (
                    <details className="risk-evidence__more">
                      <summary>근거 {item.moreCitations.length}건 더 보기</summary>
                      <ul className="risk-evidence__cites">{item.moreCitations.map((cite, index) => <Citation key={index} item={cite} />)}</ul>
                    </details>
                  )}
                </section>
              )}
            </li>
          ))}
        </ol>
      ) : <pre>{typeof formData === 'string' ? formData : JSON.stringify(formData, null, 2)}</pre>}
    </details>
  );
}
