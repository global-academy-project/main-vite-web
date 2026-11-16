import { useState } from 'react';
import FilterMenu from '../ui/filter-menu.jsx';
import Icon from '../ui/icon.jsx';
import { PERIOD_PRESETS, presetRange } from '../../utils/period-model.js';
import { APPROVAL_STATUS_LABELS, requestPeriodLabel, TARGET_FILTERS } from '../../utils/approval-model.js';
import { APPROVAL_TARGET_LABELS } from '../../utils/home-model.js';

/**
 * 승인함 필터 드롭다운 (작업 목록과 같은 FilterMenu 틀).
 * 서버 목록은 한 번에 다 오고 화면에서 거르므로 요청일은 기간 제한이 없다("전체"가 기본).
 */

/** 문서 종류: 여러 개 고르기 (없으면 전체) */
export function DocTypeMenu({ types, setTypes }) {
  const allOn = types.length === TARGET_FILTERS.length;
  const value = !types.length || allOn ? '전체' : types.length === 1 ? APPROVAL_TARGET_LABELS[types[0]] : `${APPROVAL_TARGET_LABELS[types[0]]} 외 ${types.length - 1}`;
  const toggle = (type) => setTypes(types.includes(type) ? types.filter((item) => item !== type) : [...types, type]);
  return (
    <FilterMenu label="문서" value={value} active={types.length > 0 && !allOn} width={220}>
      <div className="work-check-menu" role="group" aria-label="문서 종류 (여러 개)">
        <label className="work-check-menu__row"><input type="checkbox" checked={allOn} onChange={() => setTypes(allOn ? [] : [...TARGET_FILTERS])} />전체 선택</label>
        {TARGET_FILTERS.map((type) => (
          <label key={type} className="work-check-menu__row">
            <input type="checkbox" checked={types.includes(type)} onChange={() => toggle(type)} />{APPROVAL_TARGET_LABELS[type]}
          </label>
        ))}
      </div>
    </FilterMenu>
  );
}

/** 상태 (내 요청 탭): 하나 고르기 */
export function StatusMenu({ status, statuses, setStatus }) {
  const options = [['', '전체'], ...statuses.map((key) => [key, APPROVAL_STATUS_LABELS[key]])];
  return (
    <FilterMenu label="상태" value={status ? APPROVAL_STATUS_LABELS[status] : '전체'} active={Boolean(status)} width={180}>
      {(close) => (
        <div className="work-check-menu" role="radiogroup" aria-label="상태">
          {options.map(([key, text]) => (
            <button key={key || 'all'} type="button" role="radio" aria-checked={status === key} className="work-check-menu__option"
              onClick={() => { setStatus(key); close(); }}>
              <span className="work-check-menu__mark">{status === key && <Icon name="check" size={14} />}</span>{text}
            </button>
          ))}
        </div>
      )}
    </FilterMenu>
  );
}

/** 날짜 범위(기본 "요청일"): 전체 · 오늘 · 7일 · 30일은 바로 적용, 직접 지정은 한쪽 날짜만 넣어도 된다. 아차사고 발생일도 같이 쓴다 */
export function RequestDateMenu({ from, to, setRange, label = '요청일' }) {
  return (
    <FilterMenu label={label} value={requestPeriodLabel(from, to)} active={Boolean(from || to)} width={320}>
      {(close) => <RequestDatePanel from={from} to={to} setRange={setRange} close={close} label={label} />}
    </FilterMenu>
  );
}

function RequestDatePanel({ from, to, setRange, close, label }) {
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const error = start && end && end < start ? '끝 날짜는 시작 날짜와 같거나 뒤여야 합니다.' : '';
  const pick = (range) => { setRange(range); close(); };
  return (
    <div className="work-period-menu">
      <div className="work-period-menu__presets" role="group" aria-label="빠른 기간">
        <button type="button" className="work-chip" aria-pressed={!from && !to} onClick={() => pick({ from: '', to: '' })}>전체</button>
        {PERIOD_PRESETS.map((preset) => {
          const range = presetRange(preset.days);
          return <button key={preset.key} type="button" className="work-chip" aria-pressed={from === range.from && to === range.to} onClick={() => pick(range)}>{preset.label}</button>;
        })}
      </div>
      <p className="work-period-menu__caption">직접 지정 (한쪽만 넣어도 됩니다)</p>
      <div className="work-period-menu__range">
        <label><span className="sr-only">{label} 시작</span><input type="date" value={start} max={end || '9999-12-31'} onChange={(event) => setStart(event.target.value)} /></label>
        <span aria-hidden="true">~</span>
        <label><span className="sr-only">{label} 끝</span><input type="date" value={end} min={start || undefined} max="9999-12-31" onChange={(event) => setEnd(event.target.value)} /></label>
      </div>
      {error && <p className="work-period-menu__error" role="alert">{error}</p>}
      <div className="work-period-menu__actions">
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => close()}>취소</button>
        <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" disabled={Boolean(error)} onClick={() => pick({ from: start, to: end })}>적용</button>
      </div>
    </div>
  );
}
