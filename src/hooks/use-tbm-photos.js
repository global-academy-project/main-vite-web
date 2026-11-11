import { useCallback, useEffect, useRef, useState } from 'react';
import { correctPhotoCheck, deleteAttachment, getTbmPhotoSummary, getTbmPhotos, photoBlob, recheckTbmPhotos, uploadTbmPhoto } from '../api/attachments.js';
import { useToast } from '../components/ui/toast-context.js';
import { isStale, splitFiles } from '../utils/tbm-photo-model.js';

/**
 * TBM 사진: 목록·올리기·지우기·결과 고치기(작성자, 사유 필수)·다시 확인, 썸네일(파일을 받아 화면 주소로 바꿈).
 *  - 올리면 서버가 바로 확인(촬영 날짜·같은 사진)해서 결과를 같이 준다. 결과는 알림일 뿐 제출을 막지 않는다
 *  - TBM 날짜가 바뀌어 확인 때 날짜와 다르면 고칠 수 있는 TBM 일 때 한 번 다시 확인한다
 *  - 응답을 모르는 쓰기(시간 초과 등)는 목록을 다시 불러 서버 반영 여부를 보여 준다
 */
export function useTbmPhotos({ tbmId, tbmDate, editable, rosterKey = '' }) {
  const toast = useToast();
  const [photos, setPhotos] = useState([]);
  const [state, setState] = useState({ key: null, error: '' });
  const [busy, setBusy] = useState('');
  const [revision, setRevision] = useState(0);
  const [thumbs, setThumbs] = useState({});
  const urls = useRef({});
  const rechecked = useRef('');
  const key = `${tbmId}:${revision}`;
  const loading = state.key !== key;
  const [summary, setSummary] = useState(null);
  const [summaryRevision, setSummaryRevision] = useState(0);
  const refreshSummary = () => setSummaryRevision((value) => value + 1);

  // 사진 속 인원 ↔ 참석자 명부 (참석자 저장·사진 변경 때 다시)
  useEffect(() => {
    let active = true;
    getTbmPhotoSummary(tbmId).then((next) => { if (active) setSummary(next); }).catch(() => { if (active) setSummary(null); });
    return () => { active = false; };
  }, [tbmId, rosterKey, revision, summaryRevision]);

  useEffect(() => {
    let active = true;
    getTbmPhotos(tbmId).then((list) => { if (active) { setPhotos(list); setState({ key, error: '' }); } })
      .catch((error) => { if (active) setState({ key, error: error.message || '사진 목록을 불러오지 못했습니다.' }); });
    return () => { active = false; };
  }, [tbmId, key]);

  // 썸네일: 아직 받지 않은 사진만 받는다. HEIC 처럼 브라우저가 못 그리는 형식은 화면에서 파일 이름으로 대신한다
  useEffect(() => {
    let active = true;
    photos.filter((photo) => !(photo.attachmentId in urls.current)).forEach((photo) => {
      urls.current[photo.attachmentId] = null;
      photoBlob(photo).then((blob) => {
        const url = URL.createObjectURL(blob);
        urls.current[photo.attachmentId] = url;
        if (active) setThumbs((current) => ({ ...current, [photo.attachmentId]: url }));
        else URL.revokeObjectURL(url);
      }).catch(() => { delete urls.current[photo.attachmentId]; });
    });
    return () => { active = false; };
  }, [photos]);
  useEffect(() => () => Object.values(urls.current).forEach((url) => url && URL.revokeObjectURL(url)), []);

  const failWrite = (error, fallback) => {
    toast.show({ tone: 'error', message: error.message || fallback, duration: 8000 });
    if (error.code === 'WRITE_OUTCOME_UNKNOWN') setRevision((value) => value + 1);
  };

  const upload = async (files) => {
    if (busy || !editable) return;
    const { ok, rejected } = splitFiles(files);
    rejected.forEach((message) => toast.show({ tone: 'error', message, duration: 6000 }));
    if (!ok.length) return;
    setBusy('upload');
    let added = 0;
    try {
      for (const file of ok) {
        const saved = await uploadTbmPhoto(tbmId, file);
        setPhotos((current) => [...current, saved]);
        added += 1;
      }
    } catch (error) {
      failWrite(error, '사진을 올리지 못했습니다.');
    } finally {
      setBusy('');
      if (added) refreshSummary();
      if (added) toast.show({ tone: 'success', message: `사진 ${added}장을 올렸습니다. 확인 결과를 사진 아래에서 보세요.`, duration: 5000 });
    }
  };

  const remove = async (photo) => {
    if (busy || !editable) return;
    setBusy(`delete:${photo.attachmentId}`);
    try {
      await deleteAttachment(photo.attachmentId);
      setPhotos((current) => current.filter((item) => item.attachmentId !== photo.attachmentId));
      refreshSummary();
      toast.show({ tone: 'success', message: '사진을 지웠습니다.', duration: 4000 });
    } catch (error) {
      failWrite(error, '사진을 지우지 못했습니다.');
    } finally { setBusy(''); }
  };

  /** 작성자가 고친 결과 저장 (성공하면 true) */
  const correct = async (photo, body) => {
    if (busy || !editable) return false;
    setBusy(`correct:${photo.attachmentId}`);
    try {
      const saved = await correctPhotoCheck(photo.attachmentId, body);
      setPhotos((current) => current.map((item) => (item.attachmentId === saved.attachmentId ? saved : item)));
      refreshSummary();
      toast.show({ tone: 'success', message: '사진 확인 결과를 고쳤습니다.', duration: 4000 });
      return true;
    } catch (error) {
      failWrite(error, '사진 확인 결과를 고치지 못했습니다.');
      return false;
    } finally { setBusy(''); }
  };

  const recheck = useCallback(async () => {
    setBusy('recheck');
    try { setPhotos(await recheckTbmPhotos(tbmId)); setSummaryRevision((value) => value + 1); } catch (error) {
      toast.show({ tone: 'error', message: error.message || '사진을 다시 확인하지 못했습니다.', duration: 8000 });
    } finally { setBusy(''); }
  }, [tbmId, toast]);

  const stale = photos.some((photo) => isStale(photo, tbmDate));
  useEffect(() => {
    const mark = `${tbmId}:${tbmDate}`;
    if (!loading && stale && editable && rechecked.current !== mark) { rechecked.current = mark; void recheck(); }
  }, [loading, stale, editable, tbmId, tbmDate, recheck]);

  return {
    photos, thumbs, summary, loading, error: loading ? '' : state.error, busy, stale,
    reload: () => setRevision((value) => value + 1), upload, remove, correct, recheck,
  };
}
