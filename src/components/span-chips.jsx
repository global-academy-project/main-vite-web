import { SPANS, spanLabel } from '../hooks/use-span.js';

/** 오늘 / 7일 / 30일 버튼 (고른 날짜까지). 모양은 work.css 의 work-period·work-chip */
export default function SpanChips({ span, onChange, disabled = false, label = '목록 기간' }) {
  return (
    <div className="work-period" role="group" aria-label={label}>
      {SPANS.map((days) => (
        <button key={days} type="button" className="work-chip" aria-pressed={span === days} disabled={disabled} onClick={() => onChange(days)}>{spanLabel(days)}</button>
      ))}
    </div>
  );
}
