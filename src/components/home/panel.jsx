import { Link } from 'react-router-dom';
import Icon from '../ui/icon.jsx';
import StatusView, { Skeleton } from '../ui/status-view.jsx';

/**
 * 홈 카드 틀. section 상태(loading/error/ready)에 따라 같은 모양의 상태 화면을 보인다.
 * 카드 안쪽만 스크롤되고 카드 크기는 바뀌지 않는다. toolbar(전환 버튼 등)는 머리 아래에 고정돼 스크롤되지 않는다.
 * heading: 제목 자리를 바꿀 때(승인함 | 위험·주의 제목형 탭). grip: 칸 옮기기 손잡이(제목 앞).
 * collapse: 모바일 접기 { open, toggle }. 제목이 버튼이 되고, 제목 자리가 탭이면 오른쪽 끝에 ⌄/⌃ 버튼. 접어도 내용은 내리지 않고 숨긴다.
 */
export default function Panel({ id, title, heading, grip, count, tag, link, linkLabel = '전체 보기', section, onRetry, empty, isEmpty, className = '', children, actions, toolbar, collapse }) {
  const headingId = `home-${id}-title`;
  const bodyId = `home-${id}-body`;
  const open = !collapse || collapse.open;
  let body = children;
  if (section?.status === 'loading') body = <div className="home-panel__pad"><Skeleton lines={4} /></div>;
  else if (section?.status === 'error') {
    body = section.code === 403
      ? <StatusView kind="forbidden" compact />
      : <StatusView kind="error" compact message={section.error} onRetry={onRetry} />;
  } else if (isEmpty) body = <StatusView kind="empty" compact title={empty?.title} message={empty?.message} action={empty?.action} />;

  return (
    <section className={`home-panel ${className}${open ? '' : ' is-collapsed'}`.trim()} aria-labelledby={heading ? undefined : headingId} aria-label={heading ? title : undefined}>
      <header className="home-panel__head">
        {grip}
        {heading ?? (
          <h2 id={headingId} className="home-panel__title">
            {collapse ? (
              <button type="button" className="home-panel__fold" aria-expanded={open} aria-controls={bodyId} onClick={collapse.toggle}>
                {title}
                {tag && <span className="home-panel__tag">{tag}</span>}
                {count != null && <span className="home-panel__count">{count}</span>}
              </button>
            ) : (
              <>
                {title}
                {tag && <span className="home-panel__tag">{tag}</span>}
                {count != null && <span className="home-panel__count">{count}</span>}
              </>
            )}
          </h2>
        )}
        <div className="home-panel__actions">
          {actions}
          {link && <Link className="home-panel__link" to={link}>{linkLabel}</Link>}
        </div>
        {/* ⌄/⌃ 는 모든 카드에서 머리 오른쪽 끝 같은 자리 (제목을 눌러도 같은 동작) */}
        {collapse && <FoldButton open={open} label={title} controls={bodyId} onToggle={collapse.toggle} />}
      </header>
      {open && toolbar}
      <div className="home-panel__body" id={bodyId} hidden={!open}>{body}</div>
    </section>
  );
}

/** 상태 배지: 색 + 글자 (색만으로 구분하지 않는다) */
export function Badge({ tone = 'neutral', children }) {
  return <span className={`home-badge home-badge--${tone}`}>{children}</span>;
}

/** 모바일 카드 접기 버튼 (제목 자리가 탭인 카드: 승인함|위험·주의, AI 도우미) */
export function FoldButton({ open, label, controls, onToggle }) {
  return (
    <button type="button" className="ui-icon-btn home-panel__fold-btn" aria-expanded={open} aria-controls={controls}
      aria-label={`${label} ${open ? '접기' : '펼치기'}`} title={open ? '접기' : '펼치기'} onClick={onToggle}>
      <Icon name={open ? 'chevronUp' : 'chevronDown'} size={18} />
    </button>
  );
}
