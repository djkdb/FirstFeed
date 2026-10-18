// 발표용 「미리 만든 결과」 배지 (결정 2026-10-18): 기준 시각(점검 탭에서 켬) 이전에 만든 것에만 붙인다 — 실시간처럼 보이게 하지 않으려고
import { useEffect, useState } from 'react';
import { localTime } from './time.ts';

/** DB 시각("YYYY-MM-DD HH:MM:SS", UTC)이 기준 시각(ISO) 이전인가 */
export function isPremade(dbUtc: string | null | undefined, before: string | null): boolean {
  if (!before || !dbUtc) return false;
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(dbUtc) ? dbUtc : `${dbUtc.replace(' ', 'T')}Z`);
  const b = Date.parse(before);
  return Number.isFinite(t) && Number.isFinite(b) && t <= b;
}

// 화면 여러 곳이 같은 값을 쓰므로 한 번 불러와 나눠 쓴다. 바꾸면 알림
let cached: string | null | undefined;
const listeners = new Set<(v: string | null) => void>();
export function setPremadeBefore(v: string | null): void {
  cached = v;
  listeners.forEach((f) => f(v));
}

export function usePremadeBefore(): string | null {
  const [v, setV] = useState<string | null>(cached ?? null);
  useEffect(() => {
    listeners.add(setV);
    if (cached === undefined)
      void fetch('/api/demo')
        .then((r) => r.json() as Promise<{ premadeBefore: string | null }>)
        .then((b) => setPremadeBefore(b.premadeBefore))
        .catch(() => setPremadeBefore(null));
    return () => void listeners.delete(setV);
  }, []);
  return v;
}

export function PremadeBadge({ createdAt }: { createdAt: string | null | undefined }) {
  const before = usePremadeBefore();
  if (!isPremade(createdAt, before)) return null;
  return <span className="premade">미리 만든 결과 · 만든 때 {localTime(createdAt!)}</span>;
}

/** 「점검」 탭: 발표 직전에 켜면 지금까지 만든 것에 배지가 붙고, 그 뒤 만든 것(실시간)엔 안 붙는다 */
export function DemoMode() {
  const before = usePremadeBefore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = async (on: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/demo', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on }) });
      // 실패를 조용히 넘기지 않는다 — 처음엔 서버 500 인데 화면이 아무 말 없이 그대로였다
      if (!r.ok) throw new Error(`바꾸지 못했습니다(서버 ${r.status}). 서버 로그를 확인하고 다시 눌러 주세요.`);
      setPremadeBefore(((await r.json()) as { premadeBefore: string | null }).premadeBefore);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card">
      <h2>발표 — 「미리 만든 결과」 표시</h2>
      <p className="muted small">켜면 지금까지 만든 프로필·브랜딩 키트·카드 세트에 「미리 만든 결과」 배지가 붙어요. 그 뒤에 실시간으로 만든 것에는 안 붙어요.</p>
      {before ? (
        <p>
          켜짐 · 기준 {new Date(before).toLocaleString('sv-SE').slice(0, 16)}{' '}
          <button type="button" disabled={busy} onClick={() => void set(true)}>
            지금으로 다시 정하기
          </button>{' '}
          <button type="button" disabled={busy} onClick={() => void set(false)}>
            표시 끄기
          </button>
        </p>
      ) : (
        <button type="button" className="primary" disabled={busy} onClick={() => void set(true)}>
          지금까지 만든 결과를 「미리 만든 결과」로 표시
        </button>
      )}
      {err && <p className="status error small">{err}</p>}
    </section>
  );
}
