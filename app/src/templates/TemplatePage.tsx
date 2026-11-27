// 템플릿 고정 (FR-TP-1·3). 시안 3개를 지금 브랜드로 그려 나란히 보여 주고, 하나를 고정한다.
// 그리기는 서버(Playwright)가 한다 — 화면은 PNG 를 받아 보여 줄 뿐이라 화면과 결과물이 어긋나지 않는다
import { useCallback, useEffect, useState } from 'react';
import type { InferResponseType } from 'hono/client';
import { api } from '../api.ts';
import { localTime } from '../time.ts';

type State = InferResponseType<typeof api.api.templates.$get>;
interface Frame {
  kind: string;
  ok: boolean;
  png: string | null;
  problems: string[];
  shorten: string[];
  scale: number;
  browser: string;
  reference: boolean;
}
type DraftId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
const KIND_LABEL: Record<string, string> = { cover: '표지', body: '본문', closing: '마무리', reel_cover: '릴스 표지' };

async function fetchState(): Promise<State> {
  return (await api.api.templates.$get()).json();
}

function Frames({ frames }: { frames: Frame[] }) {
  return (
    <>
      <div className="frames">
        {frames.map((f) => (
          <figure key={f.kind} className={f.ok ? 'frame' : 'frame bad'}>
            {f.png ? <img src={f.png} alt={`${KIND_LABEL[f.kind]} 시안`} /> : <div className="noimg">그리지 못함</div>}
            <figcaption className="small">
              {KIND_LABEL[f.kind]}
              {f.scale < 1 && <span className="muted"> · 글자 {Math.round(f.scale * 100)}%</span>}
            </figcaption>
            {[...f.problems, ...f.shorten].map((p, i) => (
              <p key={i} className="status error small">
                {p}
              </p>
            ))}
          </figure>
        ))}
      </div>
      {frames[0] && (
        <p className="muted small">
          찍은 브라우저: {frames[0].browser}
          {!frames[0].reference && <strong> · 기준 브라우저 아님 — 넘침 판정이 기준과 다를 수 있어요</strong>}
        </p>
      )}
    </>
  );
}

export function TemplatePage() {
  const [state, setState] = useState<State | null>(null);
  const [frames, setFrames] = useState<Record<string, Frame[] | 'loading' | { error: string }>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => fetchState().then(setState), []);

  const preview = useCallback(async (draftId: DraftId) => {
    setFrames((f) => ({ ...f, [draftId]: 'loading' }));
    try {
      const r = await api.api.templates.preview.$post({ json: { draftId } });
      const b = (await r.json().catch(() => ({ error: `서버 오류(HTTP ${r.status})로 그리지 못했습니다. 터미널의 서버 로그를 확인하세요.` }))) as { frames?: Frame[]; error?: string };
      setFrames((f) => ({ ...f, [draftId]: b.frames ?? { error: b.error ?? '그리지 못했습니다.' } }));
    } catch (e) {
      // 응답이 없거나 JSON 이 아니어도 「그리는 중」에 머물지 않게 (CLAUDE.md 겪은 오류: 화면은 실패를 반드시 보인다)
      setFrames((f) => ({ ...f, [draftId]: { error: `서버에 닿지 못했습니다 (${String(e)}). npm run dev 가 실행 중인지 확인하세요.` } }));
    }
  }, []);

  useEffect(() => {
    void fetchState().then(async (s) => {
      setState(s);
      // 시안 셋을 차례로 그린다 (서버 브라우저 하나를 돌려 쓰므로 한꺼번에 보내지 않는다)
      if (s.missing.length === 0) for (const d of s.drafts) await preview(d.id as DraftId);
    });
  }, [preview]);

  const fix = async (draftId: DraftId) => {
    setBusy(true);
    setNotice(null);
    try {
      const r = await api.api.templates.fix.$post({ json: { draftId } });
      const b = (await r.json().catch(() => ({ error: `서버 오류(HTTP ${r.status})로 고정하지 못했습니다.` }))) as { version?: number; error?: string };
      setNotice(b.version ? `시안 ${draftId} 를 v${b.version} 로 고정했어요. 이제 모든 카드가 이 틀로 나와요.` : (b.error ?? '고정하지 못했습니다.'));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!state) return <section className="card">불러오는 중…</section>;
  const budget = state.fixed?.budget as Record<string, Record<string, { charsPerLine: number; maxLines: number | null; maxChars: number | null }>> | undefined;

  return (
    <>
      <section className="card">
        <h2>템플릿</h2>
        {state.missing.length > 0 ? (
          <p className="note">「브랜드」 탭에서 {state.missing.join('·')}을(를) 먼저 고르세요. 고른 색·폰트로 시안을 그려 보여 드려요.</p>
        ) : (
          <p className="muted small">시안 셋을 지금 브랜드(고른 팔레트·폰트·아이디)로 그렸어요. 하나를 고정하면 이후 모든 카드가 그 틀로 나와요. 고정한 뒤에도 다시 골라 새 판을 만들 수 있어요.</p>
        )}
        {state.fixed && (
          <p className="status ok small">
            지금 고정: 시안 {state.fixed.draftId} · v{state.fixed.version}
            {budget?.cover?.headline && ` · 표지 제목 한 줄 ${budget.cover.headline.charsPerLine}자 × ${budget.cover.headline.maxLines}줄`}
            {budget?.body?.text?.maxChars && ` · 본문 약 ${budget.body.text.maxChars}자`}
          </p>
        )}
        {notice && <p className="status ok small">{notice}</p>}
        <p className="muted small">표지·릴스 표지는 인스타 격자에서 잘리는 자리를 피해야 해요 — 그 숫자는 아직 앱에서 확인 전이라 엄하게 잡아 두었어요.</p>
        <CoverColorOptions />
      </section>

      {state.drafts.map((d) => {
        const f = frames[d.id];
        return (
          <section key={d.id} className="card">
            <div className="card-head">
              <h2>
                시안 {d.id} · {d.name}
              </h2>
              <button type="button" className="primary" disabled={busy || state.missing.length > 0} onClick={() => void fix(d.id as DraftId)}>
                {state.fixed?.draftId === d.id ? '이 틀로 다시 고정' : '이 틀로 고정'}
              </button>
            </div>
            <p className="muted small">{d.description}</p>
            {f === 'loading' && <p className="job">그리는 중…</p>}
            {f && typeof f === 'object' && 'error' in f && <p className="status error">{f.error}</p>}
            {Array.isArray(f) && <Frames frames={f} />}
          </section>
        );
      })}

      {state.versions.length > 0 && (
        <section className="card history">
          <h2>고정 이력</h2>
          <ul>
            {state.versions.map((v) => (
              <li key={v.id}>
                v{v.version} · 시안 {v.draftId} · {v.palette ?? ''} · {localTime(v.createdAt)}
                {state.fixed?.id === v.id && <span className="badge ok">지금</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** 표지 바탕색 규칙(2026-11-04) · 계획 칸 순서 맞추기 — 미리보기 계획 칸 · 실제 카드 표지 · 공유 이미지가 같은 규칙 */
type Options = { coverColorRule: 'checker' | 'single' | 'pillar'; arrangeByPillar: boolean };
const RULES: Array<{ id: Options['coverColorRule']; label: string; note: string }> = [
  { id: 'checker', label: '바둑판', note: '게시 순서대로 바탕색 / 주색을 번갈아 — 격자가 바둑판이 돼요(게시물이 늘어 칸이 밀려도 그대로)' },
  { id: 'single', label: '한 톤', note: '모든 표지를 고정한 틀 그대로' },
  { id: 'pillar', label: '축마다 다른 색', note: '축마다 팔레트의 다른 색 — 축 순서에 따라 격자 색이 고르지 않을 수 있어요' },
];

function CoverColorOptions() {
  const [opt, setOpt] = useState<Options | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch('/api/templates/options')
      .then((r) => r.json() as Promise<Options>)
      .then(setOpt)
      .catch(() => setErr('설정을 불러오지 못했어요.'));
  }, []);
  if (opt === null) return err ? <p className="status error small">{err}</p> : null;
  const save = (patch: Partial<Options>) => {
    setErr(null);
    setInfo(null);
    return fetch('/api/templates/options', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
      .then((r) => r.json() as Promise<Options>)
      .then(setOpt)
      .catch(() => setErr('바꾸지 못했어요. 다시 시도하세요.'));
  };
  // 만든 카드는 만들 때의 색으로 그려져 있다 — 규칙을 바꾼 뒤 표지만 다시 그린다(AI 없음)
  const recolor = () => {
    setBusy(true);
    setErr(null);
    setInfo(null);
    fetch('/api/preview/covers/recolor', { method: 'POST' })
      .then(async (r) => {
        const b = (await r.json()) as { redrawn?: number[]; failed?: Array<{ reason: string }>; unchanged?: number; error?: string };
        if (!r.ok) throw new Error(b.error ?? '다시 그리지 못했어요.');
        setInfo(`표지 ${b.redrawn!.length}개를 다시 그렸어요${b.unchanged ? ` · ${b.unchanged}개는 이미 맞아 그대로` : ''}.`);
        if (b.failed!.length) setErr(`표지 ${b.failed!.length}개는 그대로 뒀어요: ${b.failed![0]!.reason}`);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setBusy(false));
  };
  return (
    <div className="small">
      <p>
        표지 바탕색:{' '}
        {RULES.map((r) => (
          <label key={r.id} title={r.note} style={{ marginRight: '1em' }}>
            <input type="radio" name="coverColorRule" checked={opt.coverColorRule === r.id} onChange={() => void save({ coverColorRule: r.id })} /> {r.label}
          </label>
        ))}
        <button type="button" disabled={busy} onClick={recolor} title="AI 없이 만든 카드의 표지만 지금 규칙의 색으로 다시 그려요 — 본문 · 마무리는 그대로">
          {busy ? '표지 다시 그리는 중…' : '표지 색 다시 맞추기'}
        </button>
      </p>
      <p className="muted">{RULES.find((r) => r.id === opt.coverColorRule)!.note}. 고정한 틀은 그대로, 표지 바탕만 브랜드 팔레트 안에서 바꿔요(글자색은 명암비 4.5:1 이상으로 자동). 축은 표지의 축 배지로 보여요.</p>
      <p>
        <label>
          <input type="checkbox" checked={opt.arrangeByPillar} onChange={(e) => void save({ arrangeByPillar: e.target.checked })} /> 계획 칸 순서 맞추기(같은 축이 같은 열에 이어지지 않게)
        </label>
        <span className="muted"> — 축마다 다른 색일 때 세로 줄무늬를 막으려던 것이라 기본은 꺼 둬요. 켜면 계획을 만들 때 자동으로, 미리보기에 버튼도 보여요.</span>
      </p>
      {err && <p className="status error">{err}</p>}
      {info && <p className="status ok">{info}</p>}
    </div>
  );
}
