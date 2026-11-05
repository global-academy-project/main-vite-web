// 선 아이콘 (새 라이브러리 없이 인라인 SVG). 꾸밈용은 aria-hidden, 뜻이 있으면 label 을 넘긴다.
const paths = {
  check: ['M5 12l5 5L20 7'],
  alert: ['M12 7v6', 'M12 17h.01'],
  warning: ['M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4', 'M12 17h.01'],
  info: ['M12 8h.01', 'M11 12h1v5h1'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  clock: ['M12 7v5l3 2'],
  lock: ['M6 11h12v9H6z', 'M8 11V8a4 4 0 0 1 8 0v3'],
  inbox: ['M4 13l2-9h12l2 9', 'M4 13v7h16v-7', 'M4 13h5l1 3h4l1-3h5'],
  external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v6H4V6h6'],
  spinner: ['M12 3a9 9 0 1 0 9 9'],
  refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 5v6h-6'],
  home: ['M3 11l9-8 9 8', 'M5 10v10h14V10'],
  work: ['M4 7h16v13H4z', 'M9 7V4h6v3'],
  records: ['M5 4h14v16H5z', 'M9 9h6', 'M9 13h6', 'M9 17h3'],
  site: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'],
  admin: ['M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronUp: ['M18 15l-6-6-6 6'],
  send: ['M5 12h14', 'M13 6l6 6-6 6'],
};
const circled = new Set(['alert', 'info', 'clock']);

export default function Icon({ name, size = 20, label, className, strokeWidth = 2 }) {
  const d = paths[name];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {circled.has(name) && <circle cx="12" cy="12" r="9" />}
      {d.map((path) => <path key={path} d={path} />)}
    </svg>
  );
}
