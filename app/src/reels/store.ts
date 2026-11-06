// 편집 상태 + 되돌리기 + 자동 저장. 끌기처럼 이어지는 바꿈은 시작할 때 한 번만 이력에 넣는다(되돌리기 한 번 = 끌기 한 번)
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { withOriginals, type ReelDoc } from '../../../server/src/reels/model.ts';
import { reelApi } from './api.ts';

const LIMIT = 100;

export function useReelEditor() {
  const [state, setState] = useState<{ id: number; doc: ReelDoc } | null>(null);
  const past = useRef<ReelDoc[]>([]);
  const future = useRef<ReelDoc[]>([]);
  // 되돌리기 · 다시 하기 단추를 켜고 끄려고 개수만 상태로(목록 자체는 ref)
  const [hist, setHist] = useState({ undo: 0, redo: 0 });
  const sync = useCallback(() => setHist({ undo: past.current.length, redo: future.current.length }), []);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const current = useRef<{ id: number; doc: ReelDoc } | null>(null);
  useLayoutEffect(() => {
    current.current = state;
  }, [state]);
  const loaded = useRef(false);

  const load = useCallback((id: number, doc: ReelDoc) => {
    past.current = [];
    future.current = [];
    loaded.current = true;
    const next = { id, doc: withOriginals(doc) };
    current.current = next;
    setState(next);
    sync();
  }, [sync]);

  const update = useCallback((fn: (d: ReelDoc) => ReelDoc, history = true) => {
    const s = current.current;
    if (!s) return;
    if (history) {
      past.current = [...past.current.slice(-LIMIT + 1), s.doc];
      future.current = [];
    }
    // 새로 만든 글자도 처음 모습을 원본으로 기억. 끌기처럼 연달아 부를 때 바로 다음 부름이 새 값을 보도록 ref 도 같이
    const next = { id: s.id, doc: withOriginals(fn(s.doc)) };
    current.current = next;
    setState(next);
    if (history) sync();
  }, [sync]);
  const checkpoint = useCallback(() => {
    const s = current.current;
    if (!s) return;
    past.current = [...past.current.slice(-LIMIT + 1), s.doc];
    future.current = [];
    sync();
  }, [sync]);
  const undo = useCallback(() => {
    const s = current.current;
    const prev = past.current.pop();
    if (!prev || !s) return;
    future.current.push(s.doc);
    current.current = { id: s.id, doc: prev };
    setState(current.current);
    sync();
  }, [sync]);
  const redo = useCallback(() => {
    const s = current.current;
    const next = future.current.pop();
    if (!next || !s) return;
    past.current.push(s.doc);
    current.current = { id: s.id, doc: next };
    setState(current.current);
    sync();
  }, [sync]);

  // 자동 저장 — 바뀌고 0.6초 조용하면 서버에 쓴다
  useEffect(() => {
    if (!state) return;
    if (loaded.current) {
      loaded.current = false; // 불러온 직후는 저장할 것이 없다
      return;
    }
    setSaveState('saving');
    const t = setTimeout(() => {
      reelApi
        .save(state.id, state.doc)
        .then(() => {
          setSaveState('saved');
          setSaveError(null);
        })
        .catch((e: unknown) => {
          setSaveState('error');
          setSaveError(e instanceof Error ? e.message : String(e));
        });
    }, 600);
    return () => clearTimeout(t);
  }, [state]);

  return { reelId: state?.id ?? null, doc: state?.doc ?? null, load, update, checkpoint, undo, redo, canUndo: hist.undo > 0, canRedo: hist.redo > 0, saveState, saveError };
}
export type ReelEditor = ReturnType<typeof useReelEditor>;
