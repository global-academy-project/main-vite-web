// src/styles/tokens.css 의 분기점과 같은 값. 바꿀 때는 두 곳을 같이 바꾼다.
export const BREAKPOINTS = Object.freeze({ mobile: 640, tablet: 1024 });

/** 너비 → 'mobile' | 'tablet' | 'desktop' (경계값은 작은 쪽에 포함) */
export function breakpointOf(width) {
  if (!Number.isFinite(width)) return 'desktop';
  if (width <= BREAKPOINTS.mobile) return 'mobile';
  if (width <= BREAKPOINTS.tablet) return 'tablet';
  return 'desktop';
}
