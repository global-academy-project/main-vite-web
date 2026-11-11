import { useRef, useState } from 'react';
import { useVoiceInput } from '../../hooks/use-voice-input.js';
import Icon from '../ui/icon.jsx';
import { exampleText, insertTerm, quickTerms, shortLabel } from '../../utils/extract-model.js';
import { appendText, clock } from '../../utils/voice-model.js';

const MAX = 2000;

/**
 * 작업허가 측정값 단계의 "문장으로 채우기". 칸 입력이 주 방법이고 이건 보조다. 입력창은 허가 종류와 상관없이 하나.
 * 빠른 입력 버튼은 말(예: "산소 ")만 넣고 숫자는 사람이 쓴다.
 * 말로 입력(서버 음성 입력이 켜져 있을 때만): 녹음 → 받아 적은 글을 입력창 글 뒤에 붙인다. 칸은 채우지 않는다 (사람이 확인 후 "칸 채우기")
 * "칸 채우기"를 누르면 서버가 값을 뽑아 아래 칸을 채우고, 못 찾은 칸·기준 밖·확인할 점은 서버 판정 그대로 보여 준다.
 * data: hooks/use-permit-workspace.js (fill, fillFromText, extracting), fields: 그 허가 종류 측정 칸
 */
export default function SpeakFill({ data, fields }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const area = useRef(null);
  const fill = data.fill;
  const [voiceError, setVoiceError] = useState('');
  const voice = useVoiceInput({
    onText: (spoken) => { setVoiceError(''); setText((current) => appendText(current, spoken, MAX)); area.current?.focus(); },
    onError: setVoiceError,
  });
  const recording = voice.state === 'recording';
  const labelOf = (code) => shortLabel(fields.find((field) => field.code === code)?.label ?? code);

  const addTerm = (term) => {
    const node = area.current;
    const [next, cursor] = insertTerm(text, term, node?.selectionStart ?? text.length, node?.selectionEnd ?? text.length);
    setText(next.slice(0, MAX));
    node?.focus(); // 바로 이어서 숫자를 칠 수 있게 입력창으로 (커서는 그린 뒤 말 뒤로)
    requestAnimationFrame(() => node?.setSelectionRange(cursor, cursor));
  };
  const submit = async (event) => {
    event.preventDefault();
    await data.fillFromText(text);
  };

  if (!open) {
    return (
      <button type="button" className="speak-fill__open" disabled={data.locked} onClick={() => setOpen(true)}>
        <Icon name="send" size={16} />문장으로 채우기<span className="rec-help">예: {exampleText(fields)}</span>
      </button>
    );
  }
  return (
    <form className="speak-fill" onSubmit={submit} aria-label="문장으로 측정값 채우기">
      <div className="speak-fill__head">
        <strong>문장으로 채우기</strong>
        <span className="rec-help">측정한 값을 한 문장으로 적으면 아래 칸이 채워집니다. 저장 전에 칸에서 확인·수정하세요.</span>
        <button type="button" className="ui-icon-btn" aria-label="닫기" onClick={() => setOpen(false)}><Icon name="close" size={16} /></button>
      </div>
      <div className="speak-fill__terms" aria-label="빠른 입력 (말만 넣고 숫자는 직접)">
        {quickTerms(fields).map((term) => <button key={term} type="button" className="work-chip" disabled={data.extracting} onClick={() => addTerm(term)}>{term}</button>)}
      </div>
      <div className="speak-fill__input">
        <textarea ref={area} rows={2} maxLength={MAX} value={text} disabled={data.extracting || voice.state !== 'idle'} placeholder={`예: ${exampleText(fields)}`}
          onChange={(event) => setText(event.target.value)} />
        {voice.available && (
          <button type="button" className={`ui-icon-btn speak-fill__mic${recording ? ' is-recording' : ''}`}
            disabled={data.extracting || voice.state === 'sending'} aria-pressed={recording}
            aria-label={recording ? '녹음 멈추기' : voice.state === 'sending' ? '받아 적는 중' : '말로 입력'} title={recording ? '녹음 멈추기' : '말로 입력'}
            onClick={() => { setVoiceError(''); if (recording) voice.stop(); else void voice.start(); }}>
            <Icon name={recording ? 'stop' : voice.state === 'sending' ? 'spinner' : 'mic'} size={20} />
          </button>
        )}
        <button type="submit" className="ui-btn ui-btn--primary" disabled={data.extracting || data.locked || !text.trim()}>{data.extracting ? '뽑는 중…' : '칸 채우기'}</button>
      </div>
      {recording && <p className="rec-help speak-fill__voice" role="status"><span className="speak-fill__clock">녹음 중 {clock(voice.elapsed)} / {clock(voice.maxSeconds)}</span>측정값을 또박또박 말하고 ■ 를 누르세요 ({voice.maxSeconds}초가 되면 자동으로 멈춥니다).</p>}
      {voice.state === 'sending' && <p className="rec-help speak-fill__voice" role="status">받아 적는 중…</p>}
      {voiceError && <p className="work-form__error speak-fill__voice" role="alert"><Icon name="alert" size={14} />{voiceError}</p>}
      {fill && (
        <div className="speak-fill__result" role="status">
          <p><Icon name="check" size={14} />{fill.filled.length ? `${fill.filled.map(labelOf).join(', ')} 칸을 채웠습니다.` : '채울 수 있는 값을 찾지 못했습니다.'}</p>
          {fill.missing.length > 0 && <p className="is-missing"><Icon name="info" size={14} />입력 필요: {fill.missing.map(labelOf).join(', ')} — 아래 칸에 직접 넣거나 문장에 더 적어 주세요.</p>}
          {Object.keys(fill.out).length > 0 && <p className="is-out"><Icon name="warning" size={14} />기준 밖: {Object.entries(fill.out).map(([code, item]) => `${labelOf(code)} (기준 ${item.expected})`).join(', ')}</p>}
          {fill.watcher && <p><Icon name="info" size={14} />감시인 "{fill.watcher}"을(를) 찾았습니다. 감시인은 1단계 허가서에서 저장합니다.</p>}
          {fill.notes.map((note, index) => <p key={index} className="is-note">· {note}</p>)}
        </div>
      )}
    </form>
  );
}
