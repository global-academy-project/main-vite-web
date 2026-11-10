import { useEffect, useRef, useState } from 'react';
import { getTbmPhotos } from '../../api/attachments.js';
import { useBreakpoint } from '../../hooks/use-breakpoint.js';
import { useTbmPhotos } from '../../hooks/use-tbm-photos.js';
import { checkChip, PHOTO_ACCEPT, photoSummary, summaryText } from '../../utils/tbm-photo-model.js';
import { Badge } from '../home/panel.jsx';
import Icon from '../ui/icon.jsx';
import StatusView, { Skeleton } from '../ui/status-view.jsx';

/**
 * TBM 사진 칸 (TBM 화면). 올리면 서버가 촬영 날짜·같은 사진을 확인해 사진마다 결과를 보여 준다.
 * 결과는 알림이고 실시 완료·확인 요청을 막지 않는다. 휴대폰 화면에서는 "바로 촬영" 버튼을 더 둔다.
 */
export default function TbmPhotos({ tbm, editable }) {
  const data = useTbmPhotos({ tbmId: tbm.tbmId, tbmDate: tbm.tbmDate, editable });
  const mobile = useBreakpoint() === 'mobile';
  const pick = useRef(null);
  const shoot = useRef(null);
  const [confirm, setConfirm] = useState(null);
  const summary = photoSummary(data.photos);
  const onFiles = (event) => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void data.upload(files); };

  return (
    <section className="home-panel tbm-card tbm-photos" aria-labelledby="tbm-photos-title">
      <header className="tbm-card__head">
        <div>
          <h2 id="tbm-photos-title">TBM 사진 {!data.loading && <span className="home-panel__count">{data.photos.length}</span>}</h2>
          <p className="rec-help">올리면 촬영 날짜가 TBM 날짜와 같은지, 이미 올린 사진과 똑같은 파일인지 확인합니다. 결과는 알림이고 제출을 막지 않습니다.</p>
        </div>
        {editable && (
          <div className="tbm-card__actions">
            {mobile && <button type="button" className="ui-btn ui-btn--primary" disabled={Boolean(data.busy)} onClick={() => shoot.current?.click()}><Icon name="camera" size={16} />바로 촬영</button>}
            <button type="button" className={`ui-btn ${mobile ? 'ui-btn--secondary' : 'ui-btn--primary'}`} disabled={Boolean(data.busy)} onClick={() => pick.current?.click()}>
              <Icon name="image" size={16} />{data.busy === 'upload' ? '올리는 중…' : '사진 올리기'}</button>
            <input ref={pick} type="file" accept={PHOTO_ACCEPT} multiple hidden onChange={onFiles} />
            <input ref={shoot} type="file" accept="image/*" capture="environment" hidden onChange={onFiles} />
          </div>
        )}
      </header>

      {data.loading && <div className="tbm-photos__pad"><Skeleton lines={2} /></div>}
      {!data.loading && data.error && <StatusView kind="error" compact message={data.error} onRetry={data.reload} />}
      {!data.loading && !data.error && (
        <>
          {summary.total > 0 && (summary.fail > 0 || summary.unsure > 0) && (
            <p className="rec-note tbm-photos__note is-warn" role="status"><Icon name="warning" size={16} />{summaryText(summary)} — 사진 아래 안내를 확인하고, 필요하면 다시 찍어 올려 주세요.</p>
          )}
          {data.busy === 'recheck' && <p className="rec-help tbm-photos__pad"><Icon name="spinner" size={14} />TBM 날짜가 바뀌어 사진을 다시 확인하는 중…</p>}
          {!summary.total ? (
            <p className="rec-note tbm-photos__note"><Icon name="info" size={16} />아직 사진이 없습니다. TBM 진행 사진을 올려 제출해 주세요.</p>
          ) : (
            <ul className="tbm-photos__grid">
              {data.photos.map((photo) => {
                const chip = checkChip(photo.check);
                const deleting = data.busy === `delete:${photo.attachmentId}`;
                return (
                  <li key={photo.attachmentId} className={`tbm-photo is-${(photo.check?.result ?? 'none').toLowerCase()}`}>
                    <div className="tbm-photo__thumb">
                      {data.thumbs[photo.attachmentId]
                        ? <Thumb src={data.thumbs[photo.attachmentId]} name={photo.fileName} />
                        : <span className="tbm-photo__placeholder"><Icon name="image" size={22} /></span>}
                    </div>
                    <div className="tbm-photo__body">
                      <div className="tbm-photo__head">
                        <Badge tone={chip.tone}>{chip.label}</Badge>
                        <span className="work-table__id">사진 #{photo.attachmentId}</span>
                      </div>
                      <p className="tbm-photo__meta">{photo.takenAt ? `촬영 ${photo.takenAt.replace('T', ' ').slice(0, 16)}` : '촬영 시각 없음'}{photo.uploadedByName ? ` · ${photo.uploadedByName}` : ''}</p>
                      {photo.check?.messages?.length > 0 && <ul className="tbm-photo__msgs">{photo.check.messages.map((message, index) => <li key={index}>{message}</li>)}</ul>}
                      {editable && (confirm === photo.attachmentId ? (
                        <div className="tbm-photo__confirm">
                          <span>이 사진을 지울까요?</span>
                          <button type="button" className="ui-btn ui-btn--ghost tbm-photo__btn is-danger" disabled={Boolean(data.busy)} onClick={async () => { await data.remove(photo); setConfirm(null); }}>{deleting ? '지우는 중…' : '지우기'}</button>
                          <button type="button" className="ui-btn ui-btn--ghost tbm-photo__btn" onClick={() => setConfirm(null)}>취소</button>
                        </div>
                      ) : <button type="button" className="ui-btn ui-btn--ghost tbm-photo__btn" disabled={Boolean(data.busy)} onClick={() => setConfirm(photo.attachmentId)}>지우기</button>)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/** HEIC 처럼 브라우저가 못 그리면 파일 이름으로 대신한다 */
function Thumb({ src, name }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <span className="tbm-photo__placeholder"><Icon name="image" size={22} /><small>{name}</small></span>;
  return <img src={src} alt={name ? `TBM 사진 ${name}` : 'TBM 사진'} loading="lazy" onError={() => setBroken(true)} />;
}

/** 한 줄 요약 (작업 허브 TBM 탭·결재 미리보기). 맞지 않음·확인 못 함이면 사진별 안내도 */
export function TbmPhotoSummary({ tbmId, detail = false }) {
  const [state, setState] = useState({ id: null, photos: [], error: '' });
  useEffect(() => {
    let active = true;
    getTbmPhotos(tbmId).then((photos) => { if (active) setState({ id: tbmId, photos, error: '' }); })
      .catch((error) => { if (active) setState({ id: tbmId, photos: [], error: error.message || '사진을 불러오지 못했습니다.' }); });
    return () => { active = false; };
  }, [tbmId]);
  if (state.id !== tbmId) return <p className="draft-muted">사진 확인 중…</p>;
  if (state.error) return <p className="draft-muted">{state.error}</p>;
  const summary = photoSummary(state.photos);
  const tone = !summary.total ? 'warn' : summary.fail ? 'block' : summary.unsure ? 'warn' : 'done';
  const flagged = state.photos.filter((photo) => ['FAIL', 'UNSURE'].includes(photo.check?.result));
  return (
    <div className="tbm-photo-summary">
      <p><Badge tone={tone}>{summaryText(summary)}</Badge>{!summary.total && <span className="draft-muted">TBM 사진을 올려 제출해 주세요.</span>}</p>
      {detail && flagged.length > 0 && (
        <ul className="tbm-photo__msgs">{flagged.map((photo) => <li key={photo.attachmentId}>사진 #{photo.attachmentId}: {photo.check.messages.join(' ')}</li>)}</ul>
      )}
    </div>
  );
}
