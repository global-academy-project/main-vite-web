import { useEffect, useRef, useState } from 'react';
import { getSttStatus, transcribe } from '../api/stt.js';
import { micError, pickMimeType } from '../utils/voice-model.js';

let statusRequest = null;   // 화면을 여러 번 열어도 상태는 한 번만 묻는다 (실패하면 다음에 다시)
const loadStatus = () => {
  statusRequest ??= getSttStatus().catch((error) => { statusRequest = null; throw error; });
  return statusRequest;
};

/**
 * 음성 입력: 녹음(최대 서버 max-seconds 초, 넘으면 자동으로 멈춤) → 서버 받아 적기 → onText(글).
 * 서버가 꺼져 있거나(app.stt.client none) 브라우저가 녹음을 못 하면 available=false (버튼 숨김).
 * state: 'idle' | 'recording' | 'sending'. 녹음은 서버에 저장되지 않는다.
 */
export function useVoiceInput({ onText, onError }) {
  const [status, setStatus] = useState(null);
  const [state, setState] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef(null);
  const timer = useRef(null);
  const callbacks = useRef({ onText, onError });
  useEffect(() => { callbacks.current = { onText, onError }; });

  const supported = typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
  useEffect(() => {
    let active = true;
    loadStatus().then((next) => { if (active) setStatus(next); }).catch(() => { if (active) setStatus(null); });
    return () => { active = false; };
  }, []);

  const cleanup = () => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    recorder.current?.stream.getTracks().forEach((track) => track.stop());
  };
  useEffect(() => () => { if (recorder.current?.state === 'recording') { recorder.current.onstop = null; recorder.current.stop(); } cleanup(); }, []);

  const stop = () => { if (recorder.current?.state === 'recording') recorder.current.stop(); };

  const start = async () => {
    if (state !== 'idle' || !status?.enabled) return;
    if (!window.isSecureContext) { callbacks.current.onError?.(micError(null, false)); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (error) { callbacks.current.onError?.(micError(error)); return; }
    const mimeType = pickMimeType((type) => window.MediaRecorder.isTypeSupported?.(type));
    const rec = new window.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    rec.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
    rec.onstop = async () => {
      cleanup();
      const blob = new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/webm' });
      if (!blob.size) { setState('idle'); callbacks.current.onError?.('녹음된 소리가 없습니다. 다시 말해 주세요.'); return; }
      setState('sending');
      try {
        const result = await transcribe(blob);
        callbacks.current.onText?.(result.text);
      } catch (error) {
        callbacks.current.onError?.(error.message || '말을 글로 바꾸지 못했습니다. 직접 적어 주세요.');
      } finally { setState('idle'); }
    };
    recorder.current = rec;
    rec.start();
    setElapsed(0); setState('recording');
    const began = Date.now();
    const limit = status.maxSeconds;
    timer.current = setInterval(() => {
      const seconds = (Date.now() - began) / 1000;
      setElapsed(seconds);
      if (seconds >= limit) stop();
    }, 250);
  };

  return {
    available: Boolean(status?.enabled) && supported,
    maxSeconds: status?.maxSeconds ?? 30,
    state, elapsed, start, stop,
  };
}
