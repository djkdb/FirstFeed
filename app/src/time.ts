// DB 의 시각(SQLite datetime('now') — UTC, 시간대 표시 없음 "YYYY-MM-DD HH:MM:SS")을 화면에는 이 컴퓨터의 현지 시각으로.
// 그대로 보이면 한국에서 오전 9시에 만든 세트가 "00:25" 로 보인다(카드 화면 확인 2026-10-15 에서 발견)
export function localTime(dbUtc: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(dbUtc);
  if (!m) return dbUtc; // 모르는 모양은 손대지 않는다
  const d = new Date(`${m[1]}T${m[2]}Z`);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
