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
