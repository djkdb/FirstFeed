// 불러오기 실패를 사람 말로 (사용자 시뮬레이션 2026-11-20: 서버가 꺼졌을 때 홈에 「Failed to execute 'json' on 'Response'…」가 그대로 보였다).
// 서버가 보낸 한국어 오류(Error.message)는 그대로 쓰고, 브라우저 · JSON 단계의 영어 오류는 화면에 내지 않고 콘솔에만 남긴다
export function loadError(e: unknown, what = '불러오지'): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/[가-힣]/.test(msg)) return `${what} 못했어요: ${msg}`;
  console.error(e);
  return `${what} 못했어요 — 서버가 응답하지 않아요. 터미널에서 npm run dev 가 켜져 있는지 확인하고 새로고침하세요.`;
}
