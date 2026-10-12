import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { fmt } from './model';
import { parseMeasurement, scrubMeasurement } from './measurements';

interface ScrubOptions {
  min: number;
  max: number;
  change?: (value: number) => void;
}
interface NumberFieldProps {
  label: string;
  value: number;
  change: (value: number) => void;
  unit?: string;
  disabled?: boolean;
  readOnly?: boolean;
  hint?: string;
  step?: number;
  scrub?: ScrubOptions;
}
export function NumberField({ label, value, change, unit = 'in', disabled = false, readOnly = false, hint, step, scrub }: NumberFieldProps) {
  const [text, setText] = useState(String(value));
  const [error, setError] = useState('');
  const [limit, setLimit] = useState('');
  const [scrubbing, setScrubbing] = useState(false);
  const skipBlur = useRef(false);
  const gesture = useRef<{ x: number; start: number; value: number; active: boolean; min: number; max: number } | null>(null);
  useEffect(() => {
    setText(disabled || readOnly ? fmt(value) : String(value));
    setError('');
  }, [value, disabled, readOnly]);

  function commit() {
    if (skipBlur.current || gesture.current?.active || readOnly) { skipBlur.current = false; return; }
    const parsed = parseMeasurement(text);
    if (parsed === null) { setError('Enter a number or fraction, e.g. 3/4.'); return; }
    setError('');
    change(parsed);
  }
  function startScrub(event: PointerEvent<HTMLInputElement>) {
    if (!scrub || disabled || event.button !== 0 || !event.isPrimary) return;
    const start = readOnly ? value : parseMeasurement(text);
    if (start === null) { setError('Enter a valid measurement before dragging it.'); return; }
    gesture.current = { x: event.clientX, start, value: start, active: false, min: scrub.min, max: scrub.max };
    setLimit('');
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveScrub(event: PointerEvent<HTMLInputElement>) {
    const active = gesture.current;
    if (!active || !scrub || Math.abs(event.clientX - active.x) < 6 && !active.active) return;
    active.active = true;
    skipBlur.current = true;
    event.preventDefault();
    setScrubbing(true);
    try {
      const result = scrubMeasurement(active.start, event.clientX - active.x, active.min, active.max);
      setLimit(result.limited ? 'Reached the usable limit for this field.' : '');
      setError('');
      if (result.value !== active.value) {
        active.value = result.value;
        setText(String(result.value));
        (scrub.change ?? change)(result.value);
      }
      event.currentTarget.setSelectionRange(0, 0);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }
  function endScrub(event: PointerEvent<HTMLInputElement>) {
    const active = gesture.current;
    gesture.current = null;
    setScrubbing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (active?.active) {
      skipBlur.current = true;
      event.currentTarget.blur();
    }
  }
  return <label className={`field ${disabled ? 'disabled' : ''} ${scrub ? 'scrubbable' : ''} ${scrubbing ? 'is-scrubbing' : ''}`}>
    <span>{label}</span>
    <div className="input-wrap">
      <input aria-label={label} inputMode="decimal" value={text} disabled={disabled} readOnly={readOnly}
        aria-invalid={!!error} title={scrub ? readOnly ? 'Hold and drag left/right to adjust this computed opening.' : 'Hold and drag left/right to adjust; click to type.' : undefined}
        onChange={event => { skipBlur.current = false; setText(event.target.value); setError(''); setLimit(''); }}
        onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
        onPointerDown={startScrub} onPointerMove={moveScrub}
        onPointerUp={endScrub} onPointerCancel={endScrub} onLostPointerCapture={() => { gesture.current = null; setScrubbing(false); }} />
      <small>{unit}</small>
    </div>
    {hint && <small className="hint">{hint}</small>}
    {step !== undefined && <span className="number-steps">{[-1, 1].map(direction => <button key={direction} type="button"
      disabled={disabled} aria-label={`${direction < 0 ? 'Decrease' : 'Increase'} ${label}`}
      onClick={event => {
        event.preventDefault();
        const current = parseMeasurement(text);
        if (current === null) { setError('Enter a valid measurement before stepping it.'); return; }
        const next = current + direction * step;
        setText(String(next)); setError(''); change(next);
      }}>{direction < 0 ? '-' : '+'}{step} {unit}</button>)}</span>}
    {limit && <small className="hint" role="status">{limit}</small>}
    {error && <small role="alert" className="field-error">{error}</small>}
  </label>;
}
