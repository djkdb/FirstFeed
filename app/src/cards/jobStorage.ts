// 긴 AI 작업의 작업 ID 를 이 브라우저에 임시 저장 — 새로고침해도 이어서 보게. 저장소를 못 쓰면 저장 없이 동작
export const KEY = { cover: 'firstfeed.cards.coverJob', body: 'firstfeed.cards.bodyJob' } as const;
export const load = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
export const save = (k: string, v: string | null) => {
  try {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  } catch {
    /* 임시 저장 없이 동작 */
  }
};
