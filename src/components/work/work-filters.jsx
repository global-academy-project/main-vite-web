import { useState } from 'react';
import FilterMenu from '../ui/filter-menu.jsx';
import Icon from '../ui/icon.jsx';
import { PERIOD_PRESETS, periodError } from '../../utils/period-model.js';
import { WORK_TYPE_LABELS } from '../../utils/home-model.js';
import { TYPE_KEYS } from '../../utils/schedule-model.js';

const short = (date) => date?.slice(5).replace('-', '/');

/** 버튼에 보일 기간 값: 오늘 / 7일 / 30일 / 11/02 ~ 11/16 */
function periodValue(period) {
  const preset = PERIOD_PRESETS.find((item) => item.key === period.preset);
  if (preset) return preset.label;
  return period.from === period.to ? short(period.from) : `${short(period.from)} ~ ${short(period.to)}`;
}

/**
 * 기간 드롭다운 (작업 목록 · 작업허가 · TBM. 11/16 B안: 남은 PeriodBar 화면은 PR6 에서 바꾼다).
 * 오늘 · 7일 · 30일은 누르면 바로 적용, 직접 지정은 두 날짜를 고르고 "적용". 한 번에 31일까지(서버 제한).
 */
export function PeriodMenu({ period, disabled = false, label = '기간' }) {
  return (
    <FilterMenu label={label} value={periodValue(period)} active={period.preset !== 'today'} width={320}>
      {(close) => <PeriodPanel period={period} close={close} disabled={disabled} />}
    </FilterMenu>
  );
}

function PeriodPanel({ period, close, disabled }) {
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  const error = periodError(from, to);
  return (
    <div className="work-period-menu">
      <div className="work-period-menu__presets" role="group" aria-label="빠른 기간">
        {PERIOD_PRESETS.map((preset) => (
          <button key={preset.key} type="button" className="work-chip" aria-pressed={period.preset === preset.key} disabled={disabled}
            onClick={() => { period.pick(preset.days); close(); }}>{preset.label}</button>
        ))}
      </div>
      <p className="work-period-menu__caption">직접 지정 (한 번에 31일까지)</p>
      <div className="work-period-menu__range">
        <label><span className="sr-only">시작 날짜</span><input type="date" value={from} max={to || '9999-12-31'} disabled={disabled} onChange={(event) => setFrom(event.target.value)} /></label>
        <span aria-hidden="true">~</span>
        <label><span className="sr-only">끝 날짜</span><input type="date" value={to} min={from} max="9999-12-31" disabled={disabled} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      {error && <p className="work-period-menu__error" role="alert">{error}</p>}
      <div className="work-period-menu__actions">
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => close()}>취소</button>
        <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" disabled={disabled || Boolean(error)} onClick={() => { period.setPeriod(from, to); close(); }}>적용</button>
      </div>
    </div>
  );
}

/** 종류 드롭다운: 여러 개 고르기 (없으면 전체) */
export function TypeMenu({ types, setTypes }) {
  const all = Object.keys(WORK_TYPE_LABELS);
  const allOn = types.length === all.length;
  const value = !types.length || allOn ? '전체' : types.length === 1 ? WORK_TYPE_LABELS[types[0]] : `${WORK_TYPE_LABELS[types[0]]} 외 ${types.length - 1}`;
  const toggle = (type) => setTypes((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));
  return (
    <FilterMenu label="종류" value={value} active={types.length > 0 && !allOn} width={220}>
      <div className="work-check-menu" role="group" aria-label="작업 종류 (여러 개)">
        <label className="work-check-menu__row"><input type="checkbox" checked={allOn} onChange={() => setTypes(allOn ? [] : all)} />전체 선택</label>
        {Object.keys(WORK_TYPE_LABELS).map((type) => (
          <label key={type} className="work-check-menu__row">
            <input type="checkbox" checked={types.includes(type)} onChange={() => toggle(type)} />
            <i className={`home-legend__sw home-legend__sw--${TYPE_KEYS[type]}`} aria-hidden="true" />{WORK_TYPE_LABELS[type]}
          </label>
        ))}
      </div>
    </FilterMenu>
  );
}

/** 할 일 드롭다운: 전체 / 할 일 있는 작업만 (예전 "할 일 있는 작업만" 체크와 같은 조건) */
export function ActionMenu({ actionOnly, setActionOnly }) {
  return (
    <FilterMenu label="할 일" value={actionOnly ? '있는 작업만' : '전체'} active={actionOnly} width={200}>
      {(close) => (
        <div className="work-check-menu" role="radiogroup" aria-label="할 일">
          {[[false, '전체'], [true, '할 일 있는 작업만']].map(([value, text]) => (
            <button key={text} type="button" role="radio" aria-checked={actionOnly === value} className="work-check-menu__option"
              onClick={() => { setActionOnly(value); close(); }}>
              <span className="work-check-menu__mark">{actionOnly === value && <Icon name="check" size={14} />}</span>{text}
            </button>
          ))}
        </div>
      )}
    </FilterMenu>
  );
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const dayText = (date) => { const [y, m, d] = date.split('-').map(Number); return `${short(date)} (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`; };
const addDay = (date, days) => { const [y, m, d] = date.split('-').map(Number); const next = new Date(y, m - 1, d + days); return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`; };

/** 버튼에 보일 하루 값: 오늘 / 11/14 (토) */
const dayValue = (date, today) => (date === today ? '오늘' : dayText(date));

/**
 * 하루 단위 날짜 드롭다운 (작업 현황). 다른 화면의 기간 드롭다운과 같은 틀에 ‹ › 하루 이동을 붙인다.
 * 판 안: 날짜 하나 + "오늘"(바로 적용), 고른 날짜는 "적용". 전날·다음 날은 ‹ › 가 맡는다.
 */
export function DayMenu({ date, today, onChange, label = '기준일', disabled = false }) {
  return (
    <div className="work-day-menu" role="group" aria-label={label}>
      <button type="button" className="ui-icon-btn" aria-label="전날" disabled={disabled} onClick={() => onChange(addDay(date, -1))}><Icon name="chevronLeft" size={18} /></button>
      <FilterMenu label={label} value={dayValue(date, today)} active={date !== today} width={280}>
        {(close) => <DayPanel date={date} today={today} onChange={onChange} close={close} disabled={disabled} />}
      </FilterMenu>
      <button type="button" className="ui-icon-btn work-day-menu__next" aria-label="다음 날" disabled={disabled} onClick={() => onChange(addDay(date, 1))}><Icon name="chevronLeft" size={18} /></button>
    </div>
  );
}

function DayPanel({ date, today, onChange, close, disabled }) {
  const [value, setValue] = useState(date);
  const pick = (next) => { onChange(next); close(); };
  return (
    <div className="work-period-menu">
      <p className="work-period-menu__caption">날짜</p>
      <div className="work-period-menu__range work-day-menu__row">
        <label><span className="sr-only">날짜</span><input type="date" value={value} max="9999-12-31" disabled={disabled} onChange={(event) => setValue(event.target.value)} /></label>
        <button type="button" className="work-chip" aria-pressed={date === today} disabled={disabled} onClick={() => pick(today)}>오늘</button>
      </div>
      <div className="work-period-menu__actions">
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => close()}>취소</button>
        <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" disabled={disabled || !value} onClick={() => pick(value)}>적용</button>
      </div>
    </div>
  );
}
