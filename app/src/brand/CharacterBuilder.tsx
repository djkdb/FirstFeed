// 개성 캐릭터 프롬프트 기계(2026-11-08). 단계마다 고르면 같은 함수(server/src/brand/character.ts)가 바로 영어 프롬프트를 조립한다 — AI 없이 즉시.
// 「내 프로필로 추천」만 AI(opus)가 선택지 표 안의 값으로 3안을 고른다. 그림은 만들지 않는다(비목표) — 프롬프트를 그림 도구에 붙여 넣어 쓴다
import { useEffect, useMemo, useState } from 'react';
import type { Palette, PaletteRole } from '../../../server/src/reels/model.ts';
import { CHARACTER_OPTIONS, characterIssues, characterPrompts, defaultCharacter, type CharacterKind, type CharacterSpec } from '../../../server/src/brand/character.ts';
import { api } from '../api.ts';
import { StageLine } from '../StageLine.tsx';
import { useJob } from '../useJob.ts';

const C = CHARACTER_OPTIONS;
const ROLES: Array<[PaletteRole, string]> = [
  ['primary', '주색'],
  ['secondary', '보조색'],
  ['accent', '강조색'],
  ['background', '바탕색'],
  ['text', '글자색'],
];
const NEUTRAL: Palette = { primary: '#4b5563', secondary: '#9ca3af', accent: '#111827', background: '#f3f4f6', text: '#111827' };

interface Saved {
  id: number;
  name: string;
  spec: CharacterSpec;
}
interface Suggestion {
  name: string;
  concept: string;
  why: string;
  spec: CharacterSpec;
}

type Opt = { id: string; ko: string };
function Chips({ label, list, value, onPick }: { label: string; list: readonly Opt[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="ch-step">
      <span className="ch-label">{label}</span>
      <div className="chips">
        {list.map((x) => (
          <button type="button" key={x.id} className={`chip${value === x.id ? ' on' : ''}`} aria-pressed={value === x.id} onClick={() => onPick(x.id)}>
            {x.ko}
          </button>
        ))}
      </div>
    </div>
  );
}
function Multi({ label, list, value, max, onPick }: { label: string; list: readonly Opt[]; value: string[]; max: number; onPick: (ids: string[]) => void }) {
  return (
    <div className="ch-step">
      <span className="ch-label">
        {label} <span className="muted small">({max}개까지)</span>
      </span>
      <div className="chips">
        {list.map((x) => {
          const on = value.includes(x.id);
          return (
            <button
              type="button"
              key={x.id}
              className={`chip${on ? ' on' : ''}`}
              aria-pressed={on}
              disabled={!on && value.length >= max}
              onClick={() => onPick(on ? value.filter((v) => v !== x.id) : [...value, x.id])}
            >
              {x.ko}
            </button>
          );
        })}
      </div>
    </div>
  );
}
function Role({ label, value, palette, onPick }: { label: string; value: PaletteRole; palette: Palette; onPick: (r: PaletteRole) => void }) {
  return (
    <div className="ch-step">
      <span className="ch-label">{label}</span>
      <div className="chips">
        {ROLES.map(([r, ko]) => (
          <button type="button" key={r} className={`chip${value === r ? ' on' : ''}`} aria-pressed={value === r} onClick={() => onPick(r)}>
            <span className="ch-dot" style={{ background: palette[r] }} /> {ko}
          </button>
        ))}
      </div>
    </div>
  );
}

const pickOne = <T,>(l: readonly T[]) => l[Math.floor(Math.random() * l.length)]!;

export function CharacterBuilder({ palette: brandPalette, hasProfile }: { palette: Palette | null; hasProfile: boolean }) {
  const palette = brandPalette ?? NEUTRAL;
  const [spec, setSpec] = useState<CharacterSpec>(defaultCharacter);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [tab, setTab] = useState<'main' | 'sheet' | 'dna'>('main');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);

  useEffect(() => {
    void api.api.brand.characters
      .$get()
      .then((r) => r.json())
      .then((b) => setSaved(b.characters as unknown as Saved[]))
      .catch(() => setError('저장한 캐릭터를 불러오지 못했어요. 새로고침해 보세요.'));
  }, []);

  const { job, cancel } = useJob(
    jobId,
    (j) => {
      setJobId(null);
      if (j.phase === 'done') setSuggestions((j.result as unknown as { candidates: Suggestion[] }).candidates);
      else if (j.phase === 'cancelled') setError('추천을 취소했어요.');
      else setError(`${j.error?.message ?? '추천하지 못했어요.'} ${j.error?.hint ?? ''}`);
    },
    () => setJobId(null),
  );

  const set = (patch: Partial<CharacterSpec>) => setSpec((s) => ({ ...s, ...patch }));
  const prompts = useMemo(() => characterPrompts(spec, palette), [spec, palette]);
  const issues = characterIssues(spec);
  const blocking = issues.filter((i) => i.level === 'error');
  const text = tab === 'main' ? prompts.main : tab === 'sheet' ? prompts.sheet : prompts.dna;

  const copy = (t: string, what: string) =>
    void navigator.clipboard.writeText(t).then(
      () => setNotice(`${what}를 복사했어요. 그림 도구에 붙여 넣으세요.`),
      () => setError('복사하지 못했어요. 글을 직접 선택해 복사하세요.'),
    );
  const randomize = () => {
    const kind = pickOne(C.kind).id as CharacterKind;
    setSpec((s) => ({
      ...s,
      kind,
      species: pickOne(C.species[kind]).id,
      style: pickOne(C.style).id,
      line: pickOne(C.line).id,
      shading: pickOne(C.shading).id,
      eyes: pickOne(C.eyes).id,
      hair: kind === 'human' ? pickOne(C.hair.slice(1)).id : 'none',
      marking: kind === 'human' ? 'none' : pickOne(C.marking).id,
      outfit: pickOne(C.outfit).id,
      accessories: [pickOne(C.accessory).id],
      personality: [pickOne(C.personality).id],
      expression: pickOne(C.expression).id,
      pose: pickOne(C.pose).id,
    }));
  };
  const save = async () => {
    setError(null);
    const r = await api.api.brand.characters.$post({ json: { id: savedId, spec: spec as unknown as Record<string, unknown> } });
    const b = (await r.json()) as { id?: number; characters?: Saved[]; error?: string };
    if (!r.ok || b.id == null) return setError(b.error ?? '저장하지 못했어요.');
    setSavedId(b.id);
    setSaved(b.characters ?? []);
    setNotice(`「${spec.name}」를 저장했어요.`);
  };
  const applyAsAccount = async () => {
    if (savedId == null) return;
    const r = await api.api.brand.characters[':id'].use.$post({ param: { id: String(savedId) } });
    const b = (await r.json()) as { profileId?: number; error?: string };
    if (!r.ok) return setError(b.error ?? '적용하지 못했어요.');
    setNotice(`프로필 「보여 주는 방식」을 「${spec.name}」 캐릭터로 바꿨어요(새 판 — 「정체성」에서 되돌릴 수 있어요). 카드 그림 프롬프트가 사람 대신 이 캐릭터를 불러요.`);
  };

  return (
    <section className="card character">
      <h2>내 캐릭터 만들기</h2>
      <p className="muted small">
        계정의 얼굴이 될 캐릭터를 고르면 그림 프롬프트가 바로 만들어져요. 그림은 이 앱이 만들지 않아요 — 프롬프트를 그림 도구에 붙여 넣어 쓰세요. 사진 같은 실사 사람 · 실존 인물 · 특정 작가 화풍은 만들지 않아요.
      </p>
      {!brandPalette && <p className="note small">아직 팔레트를 고르지 않아 회색으로 보여요. 위에서 팔레트를 고르면 캐릭터 색이 브랜드 색으로 바뀌어요.</p>}
      <div className="row ch-top">
        <button type="button" className="primary" disabled={!!jobId || !brandPalette || !hasProfile} title={!hasProfile ? '정체성 프로필을 먼저 확정하세요' : !brandPalette ? '팔레트를 먼저 고르세요' : ''} onClick={() => void api.api.brand.characters.suggest.$post().then((r) => r.json()).then((b) => setJobId(b.jobId))}>
          ✨ 내 프로필로 3안 추천(AI)
        </button>
        <button type="button" onClick={randomize}>
          무작위로
        </button>
        <button type="button" onClick={() => (setSpec(defaultCharacter()), setSavedId(null))}>
          처음부터
        </button>
        {saved.length > 0 && (
          <select aria-label="저장한 캐릭터" value={savedId ?? ''} onChange={(e) => {
            const s = saved.find((x) => x.id === Number(e.target.value));
            if (!s) return;
            setSpec({ ...defaultCharacter(), ...s.spec });
            setSavedId(s.id);
          }}>
            <option value="">저장한 캐릭터 열기…</option>
            {saved.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>
      {jobId && (
        <div className="row">
          <StageLine stage={job?.stage} />
          <button type="button" className="small" onClick={() => void cancel()}>취소</button>
        </div>
      )}
      {suggestions && (
        <div className="ch-suggest">
          {suggestions.map((x) => (
            <div key={x.name} className="ch-card">
              <strong>{x.name}</strong>
              <p>{x.concept}</p>
              <p className="muted small">{x.why}</p>
              <button type="button" className="small" onClick={() => (setSpec({ ...defaultCharacter(), ...x.spec }), setSavedId(null), setNotice(`「${x.name}」 안으로 채웠어요. 단계마다 더 고쳐도 돼요.`))}>
                이걸로 시작
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="status error small">{error}</p>}
      {notice && <p className="status small">{notice}</p>}

      <div className="ch-grid">
        <div className="ch-steps">
          <label className="ch-step">
            <span className="ch-label">이름(영문 한 낱말)</span>
            <input value={spec.name} maxLength={16} placeholder="예: Coco" onChange={(e) => set({ name: e.target.value.trim() })} />
          </label>
          <Chips label="1. 종류" list={C.kind} value={spec.kind} onPick={(id) => { const kind = id as CharacterKind; set({ kind, species: C.species[kind][0]!.id, hair: kind === 'human' ? 'short' : 'none', marking: kind === 'human' ? 'none' : spec.marking }); }} />
          <Chips label={spec.kind === 'human' ? '2. 몸 비율' : '2. 무엇'} list={C.species[spec.kind]} value={spec.species} onPick={(id) => set({ species: id })} />
          <Chips label="3. 그림체" list={C.style} value={spec.style} onPick={(id) => set({ style: id as CharacterSpec['style'] })} />
          <Chips label="4. 선" list={C.line} value={spec.line} onPick={(id) => set({ line: id as CharacterSpec['line'] })} />
          <Chips label="5. 채색" list={C.shading} value={spec.shading} onPick={(id) => set({ shading: id as CharacterSpec['shading'] })} />
          <Chips label="6. 눈" list={C.eyes} value={spec.eyes} onPick={(id) => set({ eyes: id as CharacterSpec['eyes'] })} />
          {spec.kind === 'human' ? <Chips label="7. 머리" list={C.hair} value={spec.hair} onPick={(id) => set({ hair: id as CharacterSpec['hair'] })} /> : <Chips label="7. 무늬" list={C.marking} value={spec.marking} onPick={(id) => set({ marking: id as CharacterSpec['marking'] })} />}
          <Role label="8. 몸 색" value={spec.bodyColor} palette={palette} onPick={(r) => set({ bodyColor: r })} />
          <Chips label="9. 옷" list={C.outfit} value={spec.outfit} onPick={(id) => set({ outfit: id as CharacterSpec['outfit'] })} />
          <Role label="10. 옷 · 강조 색" value={spec.accentColor} palette={palette} onPick={(r) => set({ accentColor: r })} />
          <Multi label="11. 소품" list={C.accessory} value={spec.accessories} max={2} onPick={(v) => set({ accessories: v as CharacterSpec['accessories'] })} />
          <Multi label="12. 성격" list={C.personality} value={spec.personality} max={2} onPick={(v) => set({ personality: v as CharacterSpec['personality'] })} />
          <Chips label="13. 표정" list={C.expression} value={spec.expression} onPick={(id) => set({ expression: id as CharacterSpec['expression'] })} />
          <Chips label="14. 포즈" list={C.pose} value={spec.pose} onPick={(id) => set({ pose: id as CharacterSpec['pose'] })} />
          <Chips label="15. 배경" list={C.background} value={spec.background} onPick={(id) => set({ background: id as CharacterSpec['background'] })} />
          <Chips label="16. 비율" list={C.aspect} value={spec.aspect} onPick={(id) => set({ aspect: id as CharacterSpec['aspect'] })} />
          <label className="ch-step">
            <span className="ch-label">덧붙일 말(영어, 선택)</span>
            <input value={spec.extra} maxLength={160} placeholder="예: a tiny star on the hoodie" onChange={(e) => set({ extra: e.target.value })} />
          </label>
        </div>

        <div className="ch-result">
          <div className="seg">
            <button type="button" className={tab === 'main' ? 'on' : ''} onClick={() => setTab('main')}>캐릭터 한 장</button>
            <button type="button" className={tab === 'sheet' ? 'on' : ''} onClick={() => setTab('sheet')}>캐릭터 시트</button>
            <button type="button" className={tab === 'dna' ? 'on' : ''} onClick={() => setTab('dna')}>고정 설명</button>
          </div>
          <p className="muted small">
            {tab === 'main' ? '고른 포즈 · 표정 · 배경으로 한 장.' : tab === 'sheet' ? '같은 캐릭터의 앞 · 옆 · 뒤 + 표정 6개 — 다시 뽑아도 같은 캐릭터가 나오게 참고 그림으로 쓰세요.' : '생김새 · 색만. 다른 장면을 뽑을 때 프롬프트 앞에 붙이면 같은 캐릭터로 나와요.'}
          </p>
          <pre className="ch-prompt">{text}</pre>
          <div className="row">
            <button type="button" className="primary" disabled={blocking.length > 0} onClick={() => copy(text, tab === 'main' ? '캐릭터 프롬프트' : tab === 'sheet' ? '캐릭터 시트 프롬프트' : '고정 설명')}>
              복사
            </button>
            <button type="button" disabled={blocking.length > 0 || !spec.name} onClick={() => void save()}>
              {savedId ? '저장(덮어쓰기)' : '저장'}
            </button>
            <button type="button" disabled={savedId == null || !hasProfile} title={savedId == null ? '먼저 저장하세요' : ''} onClick={() => void applyAsAccount()}>
              계정 캐릭터로 쓰기
            </button>
          </div>
          {issues.length > 0 && (
            <ul className="ch-issues small">
              {issues.map((i) => (
                <li key={i.code} className={i.level}>{i.level === 'error' ? '⚠ ' : ''}{i.message}</li>
              ))}
            </ul>
          )}
          <details>
            <summary>반영 확인 — 고른 것이 프롬프트에 들어갔나</summary>
            <ul className="ch-check small">
              {prompts.parts.map((x) => (
                <li key={x.step}>
                  <span className={x.phrase ? (prompts.main.includes(x.phrase) ? 'ok' : 'miss') : 'muted'}>{x.phrase ? (prompts.main.includes(x.phrase) ? '✓' : '✗') : '–'}</span> {x.step}: {x.picked}
                  {x.phrase && <code>{x.phrase}</code>}
                </li>
              ))}
            </ul>
          </details>
          <p className="muted small">한국어 풀이: {prompts.ko}</p>
        </div>
      </div>
    </section>
  );
}
