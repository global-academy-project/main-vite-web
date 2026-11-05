import Icon from './icon.jsx';

// 표·차트·목록의 상태 화면 하나로 통일: 불러오는 중 / 데이터 없음 / 처리 중 / 불러올 수 없음 / 권한 없음
const presets = {
  loading: { icon: 'spinner', spin: true, title: '불러오는 중입니다', role: 'status' },
  empty: { icon: 'inbox', title: '아직 항목이 없습니다' },
  processing: { icon: 'spinner', spin: true, title: 'AI가 분석하고 있습니다', role: 'status' },
  error: { icon: 'alert', title: '불러올 수 없습니다', role: 'alert' },
  forbidden: { icon: 'lock', title: '볼 수 있는 권한이 없습니다' },
};

/**
 * @param {{ kind: keyof presets, title?: string, message?: string,
 *   action?: { label: string, onClick: () => void }, onRetry?: () => void, compact?: boolean }} props
 * error 는 onRetry 를 주면 "다시 시도" 버튼이 붙는다. empty 는 action 으로 "다음 할 일" 버튼을 붙인다.
 */
export default function StatusView({ kind = 'empty', title, message, action, onRetry, compact = false }) {
  const preset = presets[kind] ?? presets.empty;
  const button = action ?? (kind === 'error' && onRetry ? { label: '다시 시도', onClick: onRetry } : null);
  return (
    <div className={`ui-status ui-status--${kind}${compact ? ' ui-status--compact' : ''}`} role={preset.role} aria-live={preset.role === 'status' ? 'polite' : undefined}>
      <span className="ui-status__icon"><Icon name={preset.icon} className={preset.spin ? 'ui-spin' : undefined} /></span>
      <p className="ui-status__title">{title ?? preset.title}</p>
      {message && <p className="ui-status__message">{message}</p>}
      {button && (
        <div className="ui-status__action">
          <button type="button" className={`ui-btn ${kind === 'error' ? 'ui-btn--ghost' : 'ui-btn--primary'}`} onClick={button.onClick}>
            {kind === 'error' && <Icon name="refresh" size={18} />}
            {button.label}
          </button>
        </div>
      )}
    </div>
  );
}

/** 불러오는 동안 자리만 잡아 두는 회색 줄 */
export function Skeleton({ lines = 3, height = 16 }) {
  return (
    <div className="ui-skeleton-stack" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className="ui-skeleton" style={{ height, width: index === lines - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  );
}
