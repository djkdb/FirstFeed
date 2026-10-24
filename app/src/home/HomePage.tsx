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
  /** 칸마다 작은 표지 — 만든 칸은 세트 표지, 계획 칸은 미리보기와 같은 계획 칸 표지(AI 없음, 서버가 그린 것을 다시 씀) */
  const [thumbs, setThumbs] = useState<Record<number, string | null>>({});

  useEffect(() => {
    call('GET', '/api/home')
      .then(setHome)
      .catch((e: Error) => setError(`불러오지 못했어요 (${e.message}). 서버가 켜져 있는지 확인하고 새로고침하세요.`));
  }, []);

  // 표지는 차례로 묻는다 — 서버가 한 번에 하나씩 그리므로(계획 칸 표지 캐시가 있으면 바로 온다)
  const slotKey = home?.slots.map((x) => `${x.idx}:${x.title}:${x.setId ?? ''}`).join('|') ?? '';
  useEffect(() => {
    if (!home?.ready) return;
    let stop = false;
    void (async () => {
      const out: Record<number, string | null> = {};
      for (const sl of home.slots) {
        if (sl.setId !== null) out[sl.idx] = `/api/cards/sets/${sl.setId}/png/01-cover.png`;
        else {
          const r = (await fetch(`/api/preview/plan/${sl.idx}/cover`).then((x) => x.json()).catch(() => null)) as { ok?: boolean; file?: string } | null;
          out[sl.idx] = r?.ok && r.file ? `/api/preview/png/${r.file}` : null;
        }
        if (stop) return;
        setThumbs({ ...out });
      }
    })();
    return () => {
      stop = true;
    };
    // 칸 제목 · 이은 세트가 바뀔 때만 다시 — 상태(올림)만 바뀌면 그림은 같다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotKey]);

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
      <div className="home-progress">
        <p className="home-progress-label">
          <b>
            {home.slots.length}칸 중 {home.counts.posted}칸 올림
          </b>
          <span className="muted small">
            {' '}
            · 만듦 {home.counts.made} · 계획 {home.counts.plan} · 시작 {home.start ? day(home.start) : '—'} · 오늘 {day(home.today)}
          </span>
        </p>
        {/* 칸마다 한 조각 — 실제 칸 상태(진행 막대처럼 짐작하지 않는다) */}
        <div className="home-bar" role="img" aria-label={`${home.slots.length}칸 중 올림 ${home.counts.posted} · 만듦 ${home.counts.made} · 계획 ${home.counts.plan}`}>
          {home.slots.map((sl) => (
            <span key={sl.idx} className={`home-bar-seg ${sl.state}${sl.idx === home.todayIdx ? ' today' : ''}`} title={`${sl.idx + 1}번 · ${STATE_LABEL[sl.state]}`} />
          ))}
        </div>
      </div>

      {today ? (
        <div className="home-today">
          {thumbs[today.idx] && <img className="home-today-thumb" src={thumbs[today.idx]!} alt={`${today.idx + 1}번 칸 표지`} />}
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
            <span className="home-thumb" aria-hidden="true">
              {thumbs[s.idx] ? <img src={thumbs[s.idx]!} alt="" loading="lazy" /> : null}
            </span>
            <span className="home-due small">
              {s.idx === home.todayIdx && <b className="home-today-tag">오늘 · </b>}
              {day(s.due)}
            </span>
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
