import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../api/auth';
import { clearToken, getCurrentUser } from '../../api/client';
import DashboardHeader from '../../components/dashboard-header';
import Sidebar from '../../components/sidebar';
import DateFactoryFilters from '../../components/date-factory-filters';
import { useTheme } from '../../contexts/theme-context';
import '../../style/job/job-dashboard.css';
import '../../style/job/job-dailey-checklist.css';

const checklistSections = [
  {
    id: 'work',
    title: '탱크 구역 기본 안전',
    description: '저장탱크 105 구역의 기본 안전 상태를 확인합니다.',
    items: [
      { itemCode: 'TANK_ACCESS', question: '저장탱크 구역의 출입 통제와 안전 표지가 적절한가?', detail: '출입 통제와 작업구역 표지 상태를 확인합니다.' },
      { itemCode: 'TANK_WALKWAY', question: '탱크 주변 통로와 작업 발판에 걸림·미끄럼 위험이 없는가?', detail: '맨홀 주변을 포함해 유출·누출 흔적과 통행로를 확인합니다.' },
      { itemCode: 'TANK_LEAK', question: '탱크·배관·밸브에서 누출 또는 이상 흔적이 없는가?', detail: '이상 발견 시 설비를 안전하게 격리하고 보고합니다.' },
    ],
  },
  {
    id: 'area',
    title: '화학물질 및 작업환경',
    description: '현장 취급 물질과 작업환경 상태를 확인합니다.',
    items: [
      { itemCode: 'CHEMICAL_LABEL', question: '취급 물질의 용기 표시와 보관 상태가 적절한가?', detail: '톨루엔(CAS 108-88-3) 취급 위치와 보관 한도를 확인합니다.' },
      { itemCode: 'CHEMICAL_MSDS', question: '취급 물질의 최신 MSDS를 현장에서 확인할 수 있는가?', detail: '비치된 MSDS 개정일과 비상조치 정보를 확인합니다.' },
      { itemCode: 'SPILL_RESPONSE', question: '유출 대응 자재가 준비되어 있고 즉시 사용할 수 있는가?', detail: '흡착포와 유출 확산 방지 수단의 위치·상태를 확인합니다.' },
      { itemCode: 'VENTILATION', question: '작업구역의 환기 및 필요한 가스 측정 상태가 적절한가?', detail: '실제 작업과 허가 조건에 맞는 측정 기준을 확인합니다.' },
    ],
  },
  {
    id: 'equipment',
    title: '비상·보호 장비',
    description: '점검 대상 구역에서 필요한 안전 장비를 확인합니다.',
    items: [
      { itemCode: 'EMERGENCY_EYEWASH', question: '비상 세안·세척 설비에 접근할 수 있고 정상 작동하는가?', detail: '접근 경로가 막히지 않았는지와 설비 상태를 확인합니다.' },
      { itemCode: 'FIRE_EQUIPMENT', question: '소화기 등 초기 화재 대응 장비를 즉시 사용할 수 있는가?', detail: '장비 위치, 접근성, 외관상 이상을 확인합니다.' },
      { itemCode: 'PPE_READY', question: '해당 작업에 필요한 개인보호구를 준비하고 사용할 수 있는가?', detail: '실제 작업 종류와 현장 위험에 맞는 보호구를 확인합니다.' },
    ],
  },
];

const statusOptions = [
  { value: 'OK', label: '양호' },
  { value: 'NG', label: '미흡' },
  { value: 'NA', label: '해당 없음' },
];

const allItems = checklistSections.flatMap((section) => section.items);
const inspectionTarget = {
  targetType: 'ZONE',
  siteName: '울산 공장',
  zoneCode: 'T-105',
  zoneName: '저장탱크 105',
  templateCode: null,
};

const factoryOptions = ['울산 공장', '여수 공장'];

function getInspectionResult(checklist) {
  const results = allItems.map((item) => checklist[item.itemCode]?.result).filter(Boolean);
  if (results.length !== allItems.length) return null;
  if (results.includes('NG')) return 'FAIL';
  if (results.includes('NA')) return 'PARTIAL';
  return 'PASS';
}

function getToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function DaileyChecklist() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { darkMode, setDarkMode } = useTheme();
  const [user, setUser] = useState(null);
  const [userError, setUserError] = useState('');
  const [checklist, setChecklist] = useState({});
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [submitted, setSubmitted] = useState(false);
  const [inspectionDate, setInspectionDate] = useState(getToday);
  const [selectedFactory, setSelectedFactory] = useState(inspectionTarget.siteName);

  const completedCount = allItems.filter((item) => checklist[item.itemCode]?.result).length;
  const issueCount = allItems.filter((item) => checklist[item.itemCode]?.result === 'NG').length;
  const progress = Math.round((completedCount / allItems.length) * 100);
  const userName = user?.name || user?.email || '사용자';
  const userInitial = Array.from(userName)[0] || '사';
  const availableFactories = Array.from(new Set([user?.factory, ...factoryOptions].filter(Boolean)));
  const summaryText = `${inspectionDate} ${selectedFactory} 일일 안전 점검 ${completedCount}/${allItems.length} 항목 확인`;
  const inspectionResult = getInspectionResult(checklist);

  const doLogout = async () => {
    try {
      await logout();
    } finally {
      clearToken();
      navigate('/signin', { replace: true });
    }
  };

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((currentUser) => {
        if (!cancelled) {
          setUser(currentUser);
          if (currentUser?.factory) setSelectedFactory(currentUser.factory);
        }
      })
      .catch((requestError) => {
        if (!cancelled) setUserError(requestError.message || '사용자 정보를 불러오지 못했습니다.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function setItemResult(itemCode, result) {
    setChecklist((current) => ({
      ...current,
      [itemCode]: { ...current[itemCode], result },
    }));
    setMessage('');
    setSubmitted(false);
  }

  function setItemNote(itemCode, note) {
    setChecklist((current) => ({
      ...current,
      [itemCode]: { ...current[itemCode], note },
    }));
    setSubmitted(false);
  }

  function saveDraft() {
    setMessageType('info');
    setMessage('작성 내용은 현재 화면에만 임시 보관되어 있습니다. 서버 저장은 아직 연결되지 않았습니다.');
  }

  function submitChecklist() {
    const unanswered = allItems.filter((item) => !checklist[item.itemCode]?.result);
    const issuesWithoutNotes = allItems.filter(
      (item) => checklist[item.itemCode]?.result === 'NG' && !checklist[item.itemCode]?.note?.trim(),
    );

    if (unanswered.length || issuesWithoutNotes.length) {
      const reasons = [];
      if (unanswered.length) reasons.push(`미확인 ${unanswered.length}개 항목`);
      if (issuesWithoutNotes.length) reasons.push(`note가 비어 있는 NG 항목 ${issuesWithoutNotes.length}개`);
      setMessageType('error');
      setMessage(`${reasons.join(', ')}을 확인해 주세요.`);
      return;
    }

    setSubmitted(true);
    setMessageType('success');
    setMessage('점검표를 확인했습니다. 현재 결과는 시연용 화면 상태이며 승인 요청이나 서버 저장은 되지 않았습니다.');
  }

  return (
    <div className="dashboard-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="dashboard-main">
        <DashboardHeader
          userInitial={userInitial}
          userName={userName}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          doLogout={doLogout}
          setSidebarOpen={setSidebarOpen}
        />
        <main className="dashboard-content checklist-page">
          <div className="page-heading checklist-heading">
            <div>
              <span className="checklist-eyebrow">ZONE INSPECTION</span>
              <h1>작업구역 점검</h1>
              <DateFactoryFilters
                date={inspectionDate}
                onDateChange={setInspectionDate}
                factory={selectedFactory}
                onFactoryChange={setSelectedFactory}
                factories={availableFactories}
              />
            </div>
            <button type="button" className="checklist-back" onClick={() => navigate('/dashboard')}>대시보드로 돌아가기</button>
          </div>

          {userError && <div className="dashboard-error" role="alert">{userError}</div>}

          <section className="inspection-metadata" aria-label="점검 기록 정보">
            <div><span>점검 대상</span><strong>{inspectionTarget.zoneCode} · {inspectionTarget.zoneName}</strong></div>
            <div><span>대상 유형</span><strong>{inspectionTarget.targetType}</strong></div>
            <div><span>공장</span><strong>{selectedFactory}</strong></div>
            <div><span>점검일</span><strong>{inspectionDate}</strong></div>
            <div><span>점검자</span><strong>{userName}</strong></div>
            <div><span>template_code</span><strong>{inspectionTarget.templateCode ?? '서버 양식 미연결'}</strong></div>
            <div><span>상태</span><strong>{submitted ? 'PENDING' : 'DRAFT'}</strong></div>
          </section>

          <section className="checklist-summary" aria-label="점검 진행 현황">
            <div className="checklist-progress-copy">
              <span>오늘의 점검 진행률</span>
              <strong>{completedCount}<small> / {allItems.length} 항목</small></strong>
            </div>
            <div
              className="checklist-progress-track"
              role="progressbar"
              aria-label="점검 완료율"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="checklist-summary-stats">
              <span><i className="summary-dot summary-good" />OK <strong>{allItems.filter((item) => checklist[item.itemCode]?.result === 'OK').length}</strong></span>
              <span><i className="summary-dot summary-issue" />NG <strong>{issueCount}</strong></span>
              <span><i className="summary-dot summary-na" />NA <strong>{allItems.filter((item) => checklist[item.itemCode]?.result === 'NA').length}</strong></span>
            </div>
          </section>

          <section className="checklist-context">
            <span className="context-icon" aria-hidden="true">!</span>
            <div>
              <strong>이 구역의 최근 작업 경고 · work_warnings</strong>
              <p>탱크 맨홀 주변 기름 유출 아차사고가 보고되었습니다. 작업 전 흡착포 설치와 미끄럼 위험 제거 여부를 확인하세요.</p>
            </div>
            <span className="pill status-waiting">확인 필요</span>
          </section>

          <div className="checklist-sections">
            {checklistSections.map((section, sectionIndex) => {
              const sectionComplete = section.items.filter((item) => checklist[item.itemCode]?.result).length;
              return (
                <section className="checklist-section panel" key={section.id}>
                  <div className="checklist-section-heading">
                    <span className="section-number">0{sectionIndex + 1}</span>
                    <div>
                      <h2>{section.title}</h2>
                      <p>{section.description}</p>
                    </div>
                    <span className="section-count">{sectionComplete}/{section.items.length}</span>
                  </div>
                  <div className="checklist-items">
                    {section.items.map((item) => {
                      const result = checklist[item.itemCode]?.result ?? '';
                      const note = checklist[item.itemCode]?.note ?? '';
                      return (
                        <article className={`checklist-item ${result === 'NG' ? 'has-issue' : ''}`} key={item.itemCode}>
                          <div className="checklist-item-main">
                            <div className="checklist-item-copy">
                              <strong>{item.question}</strong>
                              <p>{item.detail}</p>
                            </div>
                            <div className="checklist-options" role="group" aria-label={`${item.question} 점검 결과`}>
                              {statusOptions.map((option) => (
                                <button
                                  type="button"
                                  key={option.value}
                                  className={`checklist-option ${result === option.value ? `selected ${option.value.toLowerCase()}` : ''}`}
                                  aria-pressed={result === option.value}
                                  onClick={() => setItemResult(item.itemCode, option.value)}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          {result === 'NG' && (
                            <label className="checklist-note">
                              <span>note · 미흡 내용 및 조치 <b>*</b></span>
                              <textarea
                                value={note}
                                maxLength={300}
                                onChange={(event) => setItemNote(item.itemCode, event.target.value)}
                                placeholder="확인된 문제와 작업 전 조치 내용을 입력하세요."
                                rows={2}
                              />
                              <small>{note.length}/300자</small>
                            </label>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <footer className="checklist-footer">
            <span>
              {summaryText}
              {inspectionResult && <> · inspections.result: <strong>{inspectionResult}</strong></>}
              {submitted && <> · status: <strong>PENDING</strong></>}
            </span>
            <div>
              <button type="button" className="checklist-save" onClick={saveDraft}>임시 저장</button>
              <button type="button" className="checklist-submit" onClick={submitChecklist}>점검 제출</button>
            </div>
          </footer>

          {message && <div className={`checklist-message ${messageType}`} role={messageType === 'error' ? 'alert' : 'status'}>{message}</div>}
          <p className="scenario-notice">DB 매핑: inspections(target_type, inspect_date, template_code, result, status) · inspection_items(item_code, question, result, note). 화면 시연 데이터이며 서버 저장은 연결되지 않았습니다.</p>
        </main>
      </div>
    </div>
  );
}

export default DaileyChecklist;
