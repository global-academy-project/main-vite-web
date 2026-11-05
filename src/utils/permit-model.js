// 작업허가 화면 계산 (React 없이 테스트할 수 있게 분리)

export const PERMIT_TYPE_LABELS = Object.freeze({ HOT: '화기', CONFINED: '밀폐공간', HEIGHT: '고소' });
export const PERMIT_RULE_SUMMARY = Object.freeze({
  HOT: '화기는 가연성가스 측정값, 화재감시자, 안전 확인 3항목(소화기·불티 비산 방지·인화성 증기 제거)을 판정합니다.',
  CONFINED: '밀폐공간은 측정값 5종(산소·탄산가스·일산화탄소·황화수소·가연성가스), 감시인, 환기, 대피·구출 기구 비치를 판정합니다. 암모니아·염소는 기록만 하고 판정하지 않습니다.',
  HEIGHT: '고소는 측정값 없이 추락 방지 조치(하나 선택), 안전모·안전대 착용을 판정합니다. 감시자는 판정 대상이 아닙니다.',
});
export const RULE_CHECK_LABELS = Object.freeze({ PASS: '통과', FAIL: '기준 미충족', MISSING: '입력 누락' });
export const EVALUATION_LABELS = Object.freeze({ PASS: '통과', WARN: '주의', BLOCK: '차단' });
export const EVALUATION_TONES = Object.freeze({ PASS: 'done', WARN: 'warn', BLOCK: 'block' });

/**
 * 4단계 표시 (StepIndicator 모양). 측정 항목이 없는 유형은 2단계 "해당 없음".
 * 지금 단계 = current, 앞 단계이거나 다음 단계로 갈 수 있으면 done, 판정 차단이면 3단계 problem.
 */
export function permitSteps({ step, reachable, hasMeasurements, permit, currentEvaluation, submitted }) {
  const result = currentEvaluation?.result;
  const labels = [['1', '허가서 작성'], ['2', '측정값'], ['3', '규칙 판정'], ['4', '승인 요청']];
  return labels.map(([key, label]) => {
    const no = Number(key);
    let state = 'todo';
    if (no === 2 && !hasMeasurements) state = 'skip';
    else if (no === step) state = 'current';
    else if (no < step || (no < 4 && reachable[no + 1])) state = 'done';
    if (no === 3 && result === 'BLOCK' && step !== 3) state = 'problem';
    if (no === 4 && submitted) state = 'done';
    const hint = no === 1 ? (permit ? permit.permitNo : '새 허가서')
      : no === 2 ? (!hasMeasurements ? '해당 없음' : permit ? `${permit.measurements.length}건` : '')
        : no === 3 ? (result ? EVALUATION_LABELS[result] ?? result : '')
          : submitted ? '요청함' : '';
    return { key, label, state, hint };
  });
}
