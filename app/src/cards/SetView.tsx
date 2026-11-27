// 만든 카드 세트 보기 — 카드 PNG · 풀이 확인 · 재작성 기록 · 표지 그림 · 본문 사진 · 그림 프롬프트, 그 아래 채팅 고치기 · 업로드 · 티스토리
import { useCallback, useEffect, useState } from 'react';
import type { InferResponseType } from 'hono/client';
import { api } from '../api.ts';
import { notifyChanged } from '../changed.ts';
import { cardImageName, withCharacter } from '../../../server/src/cards/imageName.ts';
import { PremadeBadge } from '../premade.tsx';
import { TistoryPanel } from '../blog/TistoryPanel.tsx';
import { PublishPanel } from './PublishPanel.tsx';
import { ChatPanel } from './ChatPanel.tsx';
import { fieldOf, reasonLines, wordDiff } from './rewriteText.ts';

/** 카드 아래 표시된 풀이 문장: 「확인했어요」 체크(저장돼 다시 열어도 유지) 또는 직접 고치기(그 카드만 다시 그림) — 결정 2026-10-18 */
function GlossItem({ setId, idx, gloss, onChanged }: { setId: number; idx: number; gloss: { sentence: string; term: string; checkedAt?: string | null }; onChanged: () => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async (path: string, body: unknown) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/cards/sets/${setId}/glosses/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const b = (await r.json()) as { error?: string; ok?: boolean; problems?: string[] };
      if (b.error) throw new Error(b.error);
      if (b.ok === false) throw new Error(`다시 그리니 넘쳐요: ${(b.problems ?? []).join(' ')}`);
      setDraft(null);
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`gloss small${gloss.checkedAt ? ' checked' : ''}`}>
      <mark>{gloss.sentence}</mark>
      <br />
      <span className="muted">「{gloss.term}」 풀이 · 소재에 없는 설명이에요 — 올리기 전에 맞는지 확인하세요</span>
      {draft === null ? (
        <div className="actions">
          <label>
            <input type="checkbox" checked={!!gloss.checkedAt} disabled={busy} onChange={(e) => void send('check', { idx, sentence: gloss.sentence, checked: e.target.checked })} /> 확인했어요
          </label>
          <button type="button" className="link" disabled={busy} onClick={() => setDraft(gloss.sentence)}>
            고치기
          </button>
        </div>
      ) : (
        <div className="actions">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button type="button" disabled={busy} onClick={() => void send('edit', { idx, sentence: gloss.sentence, replacement: draft })}>
            {busy ? '다시 그리는 중…' : '저장(비우면 문장을 지워요)'}
          </button>
          <button type="button" disabled={busy} onClick={() => setDraft(null)}>
            그만두기
          </button>
        </div>
      )}
      {err && <span className="status error">{err}</span>}
    </div>
  );
}

type Rewrites = Extract<InferResponseType<(typeof api.api.cards.sets)[':id']['rewrites']['$get']>, { body: unknown }>;

/** 재작성 기록 한 줄(결정 2026-10-21 · C) — 펼치면 걸린 규칙 · 이유와 바뀐 칸 전/후. 기록은 2026-10-21 이후 만든 세트부터 남는다 */
function RewriteLine({ setId }: { setId: number }) {
  const [r, setR] = useState<Rewrites | null>(null);
  useEffect(() => {
    api.api.cards.sets[':id'].rewrites
      .$get({ param: { id: String(setId) } })
      .then(async (res) => {
        const b = (await res.json()) as Rewrites | { error: string };
        if ('body' in b) setR(b);
      })
      .catch(() => setR(null));
  }, [setId]);
  if (!r) return null;
  // 사람 말로(결정 2026-10-25): 규칙 코드 · 칸 경로 · 마크다운 기호를 보이지 않는다 — 문장은 rewriteText.ts 한 곳
  const steps = [...r.cover.map((x) => ({ ...x, part: 'cover' as const })), ...r.body.map((x) => ({ ...x, part: 'body' as const }))];
  return (
    <details className="small rewrites">
      {/* 다시 쓴 횟수와 고친 곳 수가 달라 「고친 곳 1개」 아래 세 줄이 보였다(사용자 시뮬레이션 2026-11-09) — 횟수로 센다 */}
      <summary>
        {steps.length === 0 ? 'AI 가 다시 쓴 것 없음 (한 번에 규칙 통과, 또는 기록 기능 전에 만든 세트)' : `AI 가 규칙에 걸려 다시 쓴 것 ${steps.length}번 · 고친 곳 ${steps.reduce((n, st) => n + reasonLines(st.issues, st.part).length, 0)}곳`}
      </summary>
      <ul>
        {steps.map((st, i) => (
          <li key={i}>
            <b>{st.part === 'cover' ? '표지 후보' : '본문'}</b>
            <ul className="rewrite-reasons">
              {reasonLines(st.issues, st.part).map((l) => (
                <li key={`${l.place}${l.reason}`}>
                  <b>{l.place}</b> · {l.reason}
                </li>
              ))}
            </ul>
            <ul className="rewrite-changes">
              {st.changes.map((ch) => (
                <li key={ch.path}>
                  <span className="muted">{fieldOf(ch.path, st.part)}</span>
                  <span className="rewrite-diff">
                    {wordDiff(ch.before, ch.after).map((sg, k) =>
                      sg.kind === 'del' ? <del key={k}>{sg.text}</del> : sg.kind === 'add' ? <ins key={k}>{sg.text}</ins> : <span key={k}>{sg.text}</span>,
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {!st.passedAfter && <span className="muted">(다시 쓴 것도 또 걸려 다음 단계로)</span>}
          </li>
        ))}
      </ul>
      <p className="muted">지운 것은 취소선, 더한 것은 밑줄이에요.</p>
    </details>
  );
}

export function SetView({ setId }: { setId: number }) {
  const [set, setSet] = useState<{
    coverImage: string | null;
    createdAt: string;
    cards: Array<{ idx: number; kind: string; pngFile: string; edited: boolean; photo?: string | null; image: { prompt: string; filename: string } | null; glosses: Array<{ sentence: string; term: string; checkedAt?: string | null }> | null; render: { scale: number; browser: string; reference: boolean } }>;
  } | null>(null);
  /** 계정 캐릭터(있으면) — 그림 프롬프트를 복사할 때 고정 설명을 앞에 붙인다 */
  const [character, setCharacter] = useState<{ name: string; dna: string } | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  /** 이 세트의 시안에 본문 사진 칸이 있는가 (G · I · J) */
  const [bodyPhoto, setBodyPhoto] = useState(false);
  // 같은 주소의 PNG 를 다시 그렸을 때 화면이 옛 그림을 보이지 않게
  const [rev, setRev] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      api.api.cards.sets[':id']
        .$get({ param: { id: String(setId) } })
        .then((r) => r.json() as Promise<{ set?: unknown; draftId?: string | null; bodyPhoto?: boolean }>)
        .then((b) => {
          setSet((b.set as never) ?? null);
          setCharacter((b as { character?: { name: string; dna: string } | null }).character ?? null);
          setDraftId(b.draftId ?? null);
          setBodyPhoto(b.bodyPhoto === true);
          setRev((n) => n + 1);
        }),
    [setId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  // 그림 바탕 표지(시안 F): 그림 프롬프트로 만든 그림을 올리면 표지만 다시 그린다. 본문은 파일 바이트라 RPC 대신 fetch
  const uploadCover = async (file: File) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/cards/sets/${setId}/cover-image`, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: file });
      const b = (await r.json()) as { ok?: boolean; shade?: number | null; problems?: string[]; error?: string };
      if (b.ok) setMsg({ ok: true, text: `표지를 그림 바탕으로 다시 그렸어요${b.shade ? ` (글자 뒤 띠 진하기 ${Math.round(b.shade * 100)}%)` : ''}.` });
      else setMsg({ ok: false, text: b.error ?? b.problems?.join(' ') ?? '표지를 다시 그리지 못했습니다.' });
      await load();
    } finally {
      setBusy(false);
    }
  };
  // 본문 사진 칸: 카드 한 장만 다시 그린다. file 이 null 이면 사진을 빼고 글만 있는 모양으로
  const cardPhoto = async (idx: number, file: File | null) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/cards/sets/${setId}/cards/${idx}/photo`, file ? { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: file } : { method: 'DELETE' });
      const b = (await r.json()) as { ok?: boolean; problems?: string[]; error?: string };
      if (b.ok) setMsg({ ok: true, text: file ? `${idx + 1}번 카드에 사진을 넣어 다시 그렸어요.` : `${idx + 1}번 카드의 사진을 뺐어요.` });
      else setMsg({ ok: false, text: b.error ?? (b.problems?.length ? `사진을 넣으면 글이 넘쳐요: ${b.problems.join(' ')}` : '카드를 다시 그리지 못했습니다.') });
      await load();
      notifyChanged();
    } finally {
      setBusy(false);
    }
  };
  if (!set) return <p className="muted">불러오는 중…</p>;
  const glossCount = set.cards.reduce((n, c) => n + (c.glosses?.length ?? 0), 0);
  return (
    <>
      <PremadeBadge createdAt={set.createdAt} />
      <RewriteLine setId={setId} />
      {draftId === 'F' && (
        <div className="actions small">
          <label>
            표지 그림 올리기 (그림 프롬프트로 만든 PNG·JPG){' '}
            <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(e) => e.target.files?.[0] && void uploadCover(e.target.files[0])} />
          </label>
          <span className="muted">{set.coverImage ? '그림 바탕 표지예요. 다른 그림을 올리면 바꿔요.' : '아직 그림이 없어 단색 표지예요.'}</span>
        </div>
      )}
      {msg && <p className={`status ${msg.ok ? 'ok' : 'error'} small`}>{msg.text}</p>}
      {glossCount > 0 && (
        <p className="gloss-summary small">
          소재에 없는 설명 {glossCount}곳 — 맞는지 코드로 확인할 수 없어 표시했어요. 아래 카드에서 <mark>강조한 문장</mark>을 올리기 전에 확인하세요.
        </p>
      )}
      <div className="frames">
        {set.cards.map((c) => (
          <figure key={c.idx} className="frame">
            <img src={`/api/cards/sets/${setId}/png/${c.pngFile}?v=${rev}`} alt={`${c.idx + 1}번 카드`} />
            <figcaption className="small">
              {c.idx + 1}. {c.kind === 'cover' ? '표지' : c.kind === 'closing' ? '마무리' : '본문'}
              {c.render.scale < 1 && <span className="muted"> · 글자 {Math.round(c.render.scale * 100)}%</span>}
              {c.edited && <span className="tag">직접 고침</span>}
            </figcaption>
            {bodyPhoto && c.kind === 'body' && (
              <div className="card-photo small">
                <label className="file-button">
                  {c.photo ? '사진 바꾸기' : '사진 넣기'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(e) => (e.target.files?.[0] && void cardPhoto(c.idx, e.target.files[0]), (e.target.value = ''))} />
                </label>
                {c.photo && (
                  <button type="button" className="small" disabled={busy} onClick={() => void cardPhoto(c.idx, null)}>
                    빼기
                  </button>
                )}
              </div>
            )}
            {c.glosses?.map((g) => (
              <GlossItem key={g.sentence} setId={setId} idx={c.idx} gloss={g} onChanged={() => (void load(), notifyChanged())} />
            ))}
            {c.image && (
              <details className="small">
                <summary>그림 프롬프트 · {cardImageName(c.idx, c.image.filename)}</summary>
                <pre>{withCharacter(c.image.prompt, character)}</pre>
                {character && <p className="muted">캐릭터 {character.name} 의 고정 설명을 앞에 붙였어요 — 그림 도구가 생김새를 알게. 캐릭터 시트 그림이 있으면 참고 그림으로 같이 넣으세요.</p>}
                <button type="button" className="small" onClick={() => void navigator.clipboard.writeText(withCharacter(c.image!.prompt, character)).then(() => setMsg({ ok: true, text: '그림 프롬프트를 복사했어요.' }))}>
                  복사
                </button>
              </details>
            )}
          </figure>
        ))}
      </div>
      <p className="muted small">찍은 브라우저: {set.cards[0]?.render.browser}{set.cards[0] && !set.cards[0].render.reference && ' · 기준 브라우저 아님'}</p>
      <ChatPanel setId={setId} cardCount={set.cards.length} pngOf={(i) => `/api/cards/sets/${setId}/png/${set.cards[i]?.pngFile}?v=${rev}`} onChanged={() => (void load(), notifyChanged())} />
      <PublishPanel setId={setId} cardUnchecked={set.cards.reduce((n, c) => n + (c.glosses?.filter((g) => !g.checkedAt).length ?? 0), 0)} onChanged={() => void load()} />
      <TistoryPanel setId={setId} unchecked={set.cards.reduce((n, c) => n + (c.glosses?.filter((g) => !g.checkedAt).length ?? 0), 0)} />
    </>
  );
}
