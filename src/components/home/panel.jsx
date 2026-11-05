import { Link } from 'react-router-dom';
import StatusView, { Skeleton } from '../ui/status-view.jsx';

/**
 * 홈 카드 틀. section 상태(loading/error/ready)에 따라 같은 모양의 상태 화면을 보인다.
 * 카드 안쪽만 스크롤되고 카드 크기는 바뀌지 않는다.
 */
export default function Panel({ id, title, count, tag, link, linkLabel = '전체 보기', section, onRetry, empty, isEmpty, className = '', children, actions }) {
  const headingId = `home-${id}-title`;
  let body = children;
  if (section?.status === 'loading') body = <div className="home-panel__pad"><Skeleton lines={4} /></div>;
  else if (section?.status === 'error') {
    body = section.code === 403
      ? <StatusView kind="forbidden" compact />
      : <StatusView kind="error" compact message={section.error} onRetry={onRetry} />;
  } else if (isEmpty) body = <StatusView kind="empty" compact title={empty?.title} message={empty?.message} action={empty?.action} />;

  return (
    <section className={`home-panel ${className}`.trim()} aria-labelledby={headingId}>
      <header className="home-panel__head">
        <h2 id={headingId} className="home-panel__title">
          {tag && <span className="home-panel__tag">{tag}</span>}
          {title}
          {count != null && <span className="home-panel__count">{count}</span>}
        </h2>
        <div className="home-panel__actions">
          {actions}
          {link && <Link className="home-panel__link" to={link}>{linkLabel}</Link>}
        </div>
      </header>
      <div className="home-panel__body">{body}</div>
    </section>
  );
}

/** 상태 배지: 색 + 글자 (색만으로 구분하지 않는다) */
export function Badge({ tone = 'neutral', children }) {
  return <span className={`home-badge home-badge--${tone}`}>{children}</span>;
}
