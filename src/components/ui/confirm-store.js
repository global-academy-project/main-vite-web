// 확인 창 상태 (React 밖에서도 부를 수 있게 모듈 하나에 둔다). 화면은 confirm-dialog.jsx 의 ConfirmHost.
// window.confirm 자리를 바꾼 것: confirmAction() 은 Promise<boolean> 을 돌려준다.

let current = null; // { id, title, message, confirmLabel, cancelLabel, tone, resolve }
let seq = 0;
const listeners = new Set();

const emit = () => { for (const listener of listeners) listener(); };

export function subscribeConfirm(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getConfirmState() {
  return current;
}

/**
 * 확인 창을 띄운다. 버튼 이름은 하는 일을 말한다(예: "회수", "버리고 계속").
 * 창 자리(ConfirmHost)가 없으면(테스트 등) window.confirm 으로 묻는다.
 * 이미 떠 있는 창이 있으면 그 창은 취소로 닫고 새 창을 띄운다.
 *
 * @param {{ title: string, message?: string, confirmLabel?: string, cancelLabel?: string,
 *   tone?: 'danger' | 'warn' | 'default' }} options
 * @returns {Promise<boolean>}
 */
export function confirmAction(options) {
  if (!listeners.size) {
    const text = [options.title, options.message].filter(Boolean).join('\n\n');
    return Promise.resolve(typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(text) : false);
  }
  if (current) current.resolve(false);
  return new Promise((resolve) => {
    seq += 1;
    current = { ...options, id: seq, resolve };
    emit();
  });
}

export function closeConfirm(result) {
  if (!current) return;
  const { resolve } = current;
  current = null;
  emit();
  resolve(Boolean(result));
}
