import { jobId } from '../api/jobs.js';

export function localDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function jobRecordPath(type, id) {
  if (!Number.isSafeInteger(id) || id < 1) return null;
  switch (type) {
    case 'WORK': return `/job/workspace?workId=${id}`;
    case 'PERMIT': return `/job/permits?permitId=${id}`;
    case 'RISK': return `/job/risk-assessment?riskId=${id}`;
    case 'TBM': return `/job/tbm?tbmId=${id}`;
    case 'INSPECTION': return `/job/dailey-checklist?inspectionId=${id}`;
    case 'APPROVAL': return `/approvals/${id}`;
    default: return null;
  }
}

export function siteWorkerBody(worker) {
  const name = worker.name.trim();
  const phone = worker.clearPhone ? '' : worker.phone?.trim() || null;
  const jobType = worker.jobType?.trim() || null;
  if (!name || name.length > 50 || (jobType?.length ?? 0) > 50) {
    throw new Error('작업자 이름은 1~50자, 직종은 50자 이하로 입력하세요.');
  }
  if (phone && (phone.length > 20 || !/^0[0-9]{8,10}$/.test(phone.replaceAll('-', '')))) {
    throw new Error('연락처는 0으로 시작하는 숫자 9~11자리로 입력하세요. 하이픈은 사용할 수 있습니다.');
  }
  return {
    name, ...(worker.workerId && phone === null ? {} : { phone }), jobType, employmentType: worker.employmentType,
    teamId: worker.teamId ? jobId(worker.teamId) : null,
    ...(worker.workerId ? { lockVersion: worker.lockVersion } : { assignedFrom: worker.assignedFrom || null }),
  };
}

export function tbmPermissions(record) {
  const pending = record?.approvalStatus === 'PENDING';
  return {
    pending,
    editable: record?.status === 'DRAFT' && !pending,
    canRequest: record?.status === 'DONE' && !pending,
  };
}

export function tbmHeldAt(record, now = new Date()) {
  return record.heldAt ?? `${record.tbmDate}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function tbmContentBody({ date, leaderName, workIds, points, healthCheck, teamId, zoneId, attendees }, record) {
  if (!date) throw new Error('TBM 날짜를 입력하세요.');
  const ids = workIds.trim() ? [...new Set(workIds.split(',').map(jobId))] : [];
  const pointList = points.split('\n').map((point) => point.trim()).filter(Boolean);
  if (ids.length > 50) throw new Error('연결 작업은 50개 이하여야 합니다.');
  if (pointList.length > 30 || pointList.some((point) => point.length > 300)) {
    throw new Error('교육 요점은 30개 이하, 각 300자 이하여야 합니다.');
  }
  if (leaderName.trim().length > 50 || healthCheck.trim().length > 500) {
    throw new Error('진행자는 50자 이하, 건강 확인 내용은 500자 이하여야 합니다.');
  }
  return {
    tbmDate: date, leaderName: leaderName.trim() || null, workIds: ids, points: pointList,
    teamId: teamId ? jobId(teamId) : null, zoneId: zoneId ? jobId(zoneId) : null,
    healthCheck: healthCheck.trim() || null, attendees,
    ...(record ? { lockVersion: record.lockVersion } : {}),
  };
}

export function completeTbmBody(record, heldAt, attendeeCount) {
  const count = attendeeCount.trim() === '' ? null : Number(attendeeCount);
  if (!heldAt || !Number.isFinite(Date.parse(heldAt)) || heldAt.slice(0, 10) !== record.tbmDate) {
    throw new Error('실시 일시는 TBM 날짜와 같아야 합니다.');
  }
  if (count !== null && (!Number.isSafeInteger(count) || count < 0)) {
    throw new Error('실제 참석 인원은 0 이상의 정수로 입력하거나 비워 두세요.');
  }
  return {
    lockVersion: record.lockVersion, heldAt,
    ...(count !== null ? { attendeeCount: count } : {}),
  };
}

export function riskAssessmentBody({ risk, siteId, workId, assessDate, items }) {
  if (!assessDate) throw new Error('평가일을 입력하세요.');
  if (!items.length) throw new Error('위험요인을 하나 이상 입력하세요.');
  const saved = items.map((item, index) => {
    const frequency = Number(item.frequency);
    const severity = Number(item.severity);
    const residualFrequency = item.residualFrequency === '' ? null : Number(item.residualFrequency);
    const residualSeverity = item.residualSeverity === '' ? null : Number(item.residualSeverity);
    if (!item.workStep.trim() || !item.hazard.trim() || !item.controls.trim()) {
      throw new Error(`${index + 1}번 위험요인의 작업 단계·위험요인·감소대책을 입력하세요.`);
    }
    if (![frequency, severity].every((value) => Number.isInteger(value) && value >= 1 && value <= 5)) {
      throw new Error(`${index + 1}번 위험요인의 빈도와 강도는 1~5 정수여야 합니다.`);
    }
    if ((residualFrequency == null) !== (residualSeverity == null)
      || (residualFrequency != null
        && ![residualFrequency, residualSeverity].every((value) => Number.isInteger(value) && value >= 1 && value <= 5))) {
      throw new Error(`${index + 1}번 개선 후 빈도와 강도는 둘 다 1~5로 입력하거나 둘 다 비워 두세요.`);
    }
    return {
      seq: index + 1, workStep: item.workStep.trim(), hazard: item.hazard.trim(),
      accidentType: item.accidentType.trim() || null, frequency, severity, riskLevel: item.riskLevel,
      controls: item.controls.trim(), residualFrequency, residualSeverity,
    };
  });
  return {
    assessDate, items: saved,
    ...(risk ? { lockVersion: risk.lockVersion } : {
      siteId: jobId(siteId), workId: jobId(workId), assessmentType: 'DAILY', formData: { source: 'WEB' },
    }),
  };
}

export function riskLevelNotice(requested, saved) {
  return saved.items.flatMap((item, index) => requested.items[index]?.riskLevel !== item.riskLevel
    ? [`${index + 1}번 위험요인은 빈도×강도 기준으로 ${item.riskLevel}로 저장했습니다.`] : []).join(' ');
}
