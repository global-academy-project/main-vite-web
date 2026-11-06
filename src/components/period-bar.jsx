import { PERIOD_PRESETS } from '../utils/period-model.js';

/**
 * 기간 고르기: 시작~끝 날짜 + 오늘 / 7일 / 30일. 모양은 work.css 의 work-period·work-chip.
 * period: hooks/use-period.js 결과 (from, to, preset, setPeriod, pick)
 */
export default function PeriodBar({ period, label = '기간', disabled = false }) {
  return (
    <div className="work-period" role="group" aria-label={label}>
      <label><span className="sr-only">시작 날짜</span><input type="date" value={period.from} max={period.to || '9999-12-31'} disabled={disabled} onChange={(event) => period.setPeriod(event.target.value, period.to)} /></label>
      <span aria-hidden="true">~</span>
      <label><span className="sr-only">끝 날짜</span><input type="date" max="9999-12-31" value={period.to} min={period.from} disabled={disabled} onChange={(event) => period.setPeriod(period.from, event.target.value)} /></label>
      {PERIOD_PRESETS.map((preset) => (
        <button key={preset.key} type="button" className="work-chip" aria-pressed={period.preset === preset.key} disabled={disabled} onClick={() => period.pick(preset.days)}>{preset.label}</button>
      ))}
    </div>
  );
}
