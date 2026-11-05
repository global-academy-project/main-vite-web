import { createContext, useContext } from 'react';

export const ToastContext = createContext(null);

/**
 * 저장 결과·서버 오류 알림. 화면 흐름을 밀지 않는 고정 위치에 뜬다.
 * show({ tone: 'success' | 'error' | 'info', message, duration? })
 * ToastProvider 밖에서 부르면 아무것도 하지 않는다 (기존 화면이 깨지지 않도록).
 */
export function useToast() {
  return useContext(ToastContext) ?? { show: () => {}, dismiss: () => {} };
}
