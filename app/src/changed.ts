// 「데이터가 바뀌었다」 알림 — 왼쪽 메뉴의 계정 칸 · 단계 ✓ 와 작업 콘솔이 바로 다시 읽게.
// 처음엔 탭을 옮겨야만 계정 칸이 바뀌어, 아이디를 고른 뒤에도 「아직 브랜드 없음」이 남았다(사용자 시뮬레이션 2026-11-09)
const EVENT = 'firstfeed:changed';
export const notifyChanged = () => window.dispatchEvent(new Event(EVENT));
export function onChanged(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
