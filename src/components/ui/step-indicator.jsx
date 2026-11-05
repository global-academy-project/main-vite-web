import Icon from './icon.jsx';

const stateText = { done: '완료', current: '진행 중', problem: '문제 있음', todo: '시작 전' };

/**
 * 단계 표시. PC·태블릿은 막대+번호, 모바일은 가로로 넘기는 칩(CSS 에서 바뀜).
 * 상태는 색만이 아니라 아이콘(✓ / !)과 화면 읽기용 글자로도 알린다.
 *
 * @param {{ steps: { key: string, label: string, state: 'done'|'current'|'problem'|'todo', hint?: string }[],
 *   onSelect?: (key: string) => void, label?: string }} props
 */
export default function StepIndicator({ steps, onSelect, label = '진행 단계' }) {
  return (
    <ol className="ui-steps" aria-label={label}>
      {steps.map((step, index) => {
        const state = stateText[step.state] ? step.state : 'todo';
        const content = (
          <>
            <span className="ui-step__dot" aria-hidden="true">
              {state === 'done' ? <Icon name="check" size={13} strokeWidth={3} /> : state === 'problem' ? '!' : index + 1}
            </span>
            <span className="ui-step__text">
              <span className="ui-step__label">{step.label}<span className="sr-only"> ({stateText[state]})</span></span>
              {step.hint && <span className="ui-step__hint">{step.hint}</span>}
            </span>
          </>
        );
        return (
          <li key={step.key} className={`ui-step ui-step--${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="ui-step__bar" aria-hidden="true" />
            {onSelect
              ? <button type="button" className="ui-step__button" onClick={() => onSelect(step.key)}>{content}</button>
              : <span className="ui-step__button">{content}</span>}
          </li>
        );
      })}
    </ol>
  );
}
