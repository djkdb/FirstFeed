// 「오늘 올릴 것」 홈 (FR-HM-1~3 · 결정 2026-10-24): 30일 계획에서 오늘 할 칸 → 만들기 · 업로드 준비 → 「올렸어요」.
// 「올렸어요」는 사용자 표시일 뿐이라 화면에도 「내가 표시」로 적는다(인스타에 실제로 올라갔는지 확인하지 않음)
import { useCallback, useEffect, useState } from 'react';

type SlotState = 'plan' | 'made' | 'posted';
interface Slot {
  idx: number;
  title: string;
  pillarName: string | null;
  due: string;
  state: SlotState;
  setId: number | null;
  setCover: string | null;
  postedAt: string | null;
  delayDays: number;
}
interface Home {
  ready: boolean;
  today: string;
  start: string | null;
  cadence: 'every3' | 'twice' | 'thrice';
  slots: Slot[];
  todayIdx: number | null;
  nextIdx: number | null;
  counts: { posted: number; made: number; plan: number };
  freeSets: Array<{ id: number; cover: string; createdAt: string }>;
}

const CADENCE_LABEL: Record<Home['cadence'], string> = { every3: '3일마다 1개', twice: '주 2회', thrice: '주 3회' };
const STATE_LABEL: Record<SlotState, string> = { plan: '계획', made: '만듦', posted: '올림(내가 표시)' };
const plain = (t: string) => t.replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ');
/** 'YYYY-MM-DD' → 「10월 28일 (수)」 — 요일까지 보여야 주 2 · 3회 간격이 읽힌다 */
const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

async function call(method: string, url: string, body?: unknown): Promise<Home> {
  const r = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const b = (await r.json()) as Home & { error?: string };
  if (!r.ok || b.error) throw new Error(b.error ?? '요청이 실패했습니다.');
  return b;
}

export function HomePage() {
  const [home, setHome] = useState<Home | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<string>('');

  useEffect(() => {
    call('GET', '/api/home')
      .then(setHome)
      .catch((e: Error) => setError(`불러오지 못했어요 (${e.message}). 서버가 켜져 있는지 확인하고 새로고침하세요.`));
  }, []);

  const run = useCallback((method: string, url: string, body?: unknown) => {
    setBusy(true);
    setError(null);
    call(method, url, body)
      .then(setHome)
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  }, []);

  if (!home) return <section className="card">{error ? <p className="status error">{error}</p> : <p className="muted">불러오는 중…</p>}</section>;
  if (!home.ready)
    return (
      <section className="card">
        <h2>오늘 올릴 것</h2>
        <p className="note">
          아직 30일 계획이 없어요. 정체성 → 브랜드 → 템플릿을 정한 뒤 <a href="#/preview">30일 뒤 미리보기</a>에서 「첫 9개 게시물 계획 만들기」를 누르세요.
        </p>
      </section>
    );

  const today = home.todayIdx !== null ? home.slots[home.todayIdx]! : null;
  const next = home.nextIdx !== null ? home.slots[home.nextIdx]! : null;
  const all = home.counts.posted === home.slots.length;

  return (
    <section className="card home">
      <div className="card-head">
        <h2>오늘 올릴 것</h2>
        <label className="small">
          올리는 간격{' '}
          <select value={home.cadence} disabled={busy} onChange={(e) => run('PUT', '/api/home/settings', { cadence: e.target.value })}>
            {(Object.keys(CADENCE_LABEL) as Home['cadence'][]).map((k) => (
              <option key={k} value={k}>
                {CADENCE_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted small">
        30일 진행: 올림 {home.counts.posted} · 만듦 {home.counts.made} · 계획 {home.counts.plan} · 시작 {home.start ? day(home.start) : '—'} · 오늘 {day(home.today)}
      </p>

      {today ? (
        <div className="home-today">
          <p className="eyebrow">
            오늘 할 칸 · {today.idx + 1}번 · {day(today.due)}
            {today.due < home.today ? ' (지난 날짜)' : ''}
          </p>
          <p className="home-title">
            {today.pillarName && <span className="qid">{today.pillarName}</span>}
            {today.title}
          </p>
          <p className="small">상태: {STATE_LABEL[today.state]}</p>
          <div className="actions">
            {today.state === 'plan' && (
              <>
                <a className="button primary" href={`#/make?slot=${today.idx}`}>
                  이 칸으로 만들기
                </a>
                {home.freeSets.length > 0 && (
                  <>
                    <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="이을 세트">
                      <option value="">이미 만든 세트 고르기</option>
                      {home.freeSets.map((s) => (
                        <option key={s.id} value={s.id}>
                          {plain(s.cover)}
                        </option>
                      ))}
                    </select>
                    <button type="button" disabled={busy || !pick} onClick={() => run('PUT', `/api/home/slots/${today.idx}/set`, { setId: Number(pick) })}>
                      이 칸에 잇기
                    </button>
                  </>
                )}
              </>
            )}
            {today.state === 'made' && (
              <>
                <span className="small">이은 세트: 「{plain(today.setCover ?? '')}」 — 「만들기」에서 업로드 준비 · 폰으로 받기</span>
                <a className="button" href="#/make">
                  만들기로
                </a>
              </>
            )}
            <button type="button" className={today.state === 'made' ? 'primary' : ''} disabled={busy} onClick={() => run('POST', `/api/home/slots/${today.idx}/posted`, {})}>
              올렸어요
            </button>
            <button type="button" disabled={busy} onClick={() => run('POST', `/api/home/slots/${today.idx}/delay`)}>
              하루 미루기
            </button>
          </div>
          <p className="muted small">「올렸어요」는 내가 표시하는 것 — 인스타에 실제로 올라갔는지는 확인하지 않아요. 「하루 미루기」는 이 칸부터 뒤 칸까지 하루씩 밀어요.</p>
        </div>
      ) : (
        <p className="note">{all ? `${home.slots.length}칸을 모두 올렸어요.` : next ? `오늘은 올릴 칸이 없어요. 다음: ${day(next.due)} · ${next.idx + 1}번 「${next.title}」` : '오늘은 올릴 칸이 없어요.'}</p>
      )}

      <h3>30일 계획</h3>
      <ol className="home-slots">
        {home.slots.map((s) => (
          <li key={s.idx} className={`home-slot ${s.state}${s.idx === home.todayIdx ? ' today' : ''}`}>
            <span className="home-due small">{day(s.due)}</span>
            <span className="home-slot-title">
              {s.pillarName && <span className="qid">{s.pillarName}</span>}
              {s.title}
            </span>
            <span className={`home-state ${s.state} small`}>{STATE_LABEL[s.state]}</span>
            <span className="home-slot-actions">
              {s.state === 'posted' ? (
                <button type="button" className="small" disabled={busy} onClick={() => run('DELETE', `/api/home/slots/${s.idx}/posted`)}>
                  되돌리기
                </button>
              ) : (
                <>
                  <button type="button" className="small" disabled={busy} onClick={() => run('POST', `/api/home/slots/${s.idx}/posted`, {})}>
                    올렸어요
                  </button>
                  <button type="button" className="small" disabled={busy} onClick={() => run('POST', `/api/home/slots/${s.idx}/delay`)}>
                    하루 미루기
                  </button>
                </>
              )}
            </span>
          </li>
        ))}
      </ol>
      {error && <p className="status error">{error}</p>}
    </section>
  );
}
