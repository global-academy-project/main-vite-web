import { getPermit, getWork } from '../../api/jobs';
import { getRiskAssessment } from '../../api/risk-assessments';
import { getTbm } from '../../api/tbm';

// 문서 종류별 조회 (기존 api 함수 그대로). doc = { type, id }
export const docLoaders = {
  WORK: (doc) => getWork(doc.id),
  RISK: (doc, siteId) => getRiskAssessment(doc.id, siteId),
  PERMIT: (doc, siteId) => getPermit(doc.id, siteId),
  TBM: (doc, siteId) => getTbm(doc.id, siteId),
};
