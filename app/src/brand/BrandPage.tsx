// 브랜딩 키트 (FR-BR-1~4). 글(아이디·이름·바이오)과 시각(팔레트·폰트·그림 프롬프트)을 따로 만든다 — 결정 2026-10-14.
// 후보를 누르면 바로 저장된다(이력으로 남음). 생성은 몇 분 걸려서 진행·취소를 보여 주고,
// 새로고침해도 진행 중이던 작업을 이어서 보도록 작업 ID 를 이 브라우저에 임시 저장한다.
import { useCallback, useEffect, useState } from 'react';
import type { InferResponseType } from 'hono/client';
import { api } from '../api.ts';
import { useJob } from '../useJob.ts';
import { loadBrandFonts } from './loadFonts.ts';
import { ProfileImage } from './ProfileImage.tsx';

type BrandState = InferResponseType<typeof api.api.brand.$get>;
type Kind = 'words' | 'visual';
type Patch = Parameters<typeof api.api.brand.selection.$put>[0]['json'];

const RUN_LABEL: Record<string, string> = { generate: '생성', json_retry: 'JSON 재요청', rewrite: '재작성', review: '자기 평가' };
// 시간은 측정값(tests/results/2026-10-14-brand-v1-v1.md, 3명 × 2회 평균: 글 58~82초, 시각 37~44초)
const COST: Record<Kind, string> = {
  words: 'AI 호출 2번(생성 + 자기 평가, 재작성하면 더) · 보통 1~1.5분',
  visual: 'AI 호출 1번(규칙에 걸려 다시 쓰면 더) · 보통 40초 안팎',
};
const jobKey = (k: Kind) => `firstfeed.brandJob.${k}`;

function readJob(k: Kind): string | null {
  try {
    return localStorage.getItem(jobKey(k));
  } catch {
    return null;
  }
}
function writeJob(k: Kind, id: string | null) {
  try {
    if (id) localStorage.setItem(jobKey(k), id);
    else localStorage.removeItem(jobKey(k));
  } catch {
    /* 임시 저장 없이 동작 */
  }
}

async function fetchBrand(): Promise<BrandState> {
  const r = await api.api.brand.$get();
  return r.json();
}

/** 인스타 칸 글자 수 — 서버(limits.ts instagramLength)와 같은 방식으로 엄하게 센다 */
function igLength(s: string): number {
  const g = [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(s)].length;
  return Math.max(g, s.length);
}

function KitJob({ kind, label, onDone }: { kind: Kind; label: string; onDone: () => void }) {
  const [jobId, setJobId] = useState<string | null>(() => readJob(kind));
  const [error, setError] = useState<string | null>(null);
  const { job, cancel } = useJob(jobId, (j) => {
    writeJob(kind, null);
    setJobId(null);
    if (j.phase === 'failed') setError(`${j.error?.message ?? '실패했습니다.'} ${j.error?.hint ?? ''}`);
    if (j.phase === 'cancelled') setError('취소했습니다. 다시 하려면 버튼을 누르세요.');
    onDone();
  });
  const start = async () => {
    setError(null);
    const r = kind === 'words' ? await api.api.brand.words.$post() : await api.api.brand.visual.$post();
    const b = await r.json();
    writeJob(kind, b.jobId);
    setJobId(b.jobId);
  };
  return (
    <div>
      {!jobId ? (
        <div className="actions">
          <button type="button" className="primary" onClick={() => void start()}>
            {label}
          </button>
          <span className="muted small">{COST[kind]}</span>
        </div>
      ) : (
        <div className="job">
          <p>
            만드는 중… {kind === 'words' ? '(생성 → 규칙 → 자기 평가)' : '(생성 → 명암비·폰트·프롬프트 규칙)'}
            <button type="button" onClick={() => void cancel()}>
              취소
            </button>
          </p>
          {job && job.runs.length > 0 && (
            <ol className="runs muted small">
              {job.runs.map((r) => (
                <li key={r.attempt}>
                  {RUN_LABEL[r.kind] ?? r.kind} · {r.model} · {r.status === 'ok' ? '통과' : r.status} · {((r.duration_ms ?? 0) / 1000).toFixed(1)}초
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      {error && <p className="status error">{error}</p>}
    </div>
  );
}

function Dropped({ items }: { items: Array<{ kind: string; value: string; reasons: string[] }> }) {
  if (items.length === 0) return null;
  return (
    <details className="small muted">
      <summary>규칙에 걸려 뺀 후보 {items.length}개</summary>
      <ul>
        {items.map((d, i) => (
          <li key={i}>
            <strong>{d.value}</strong> — {d.reasons.join(' / ')}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** 글 후보 하나의 목록: 누르면 바로 저장, 직접 고쳐 써서 저장할 수도 있다 */
function TextPick({
  title,
  field,
  items,
  chosen,
  max,
  hint,
  multiline,
  save,
}: {
  title: string;
  field: 'handle' | 'displayName' | 'bio';
  items: Array<{ value: string; why: string }>;
  chosen: string | null;
  max: number;
  hint?: string;
  multiline?: boolean;
  save: (p: Patch) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const n = draft === null ? 0 : igLength(draft);
  return (
    <div className="pick">
      <h3>
        {title} <span className="muted small">최대 {max}자</span>
      </h3>
      {hint && <p className="muted small">{hint}</p>}
      <ul className="options">
        {items.map((c) => (
          <li key={c.value}>
            <button type="button" className={chosen === c.value ? 'option on' : 'option'} onClick={() => void save({ [field]: c.value })}>
              <span className={field === 'bio' ? 'pre' : ''}>{c.value}</span>
              <span className="muted small"> · {igLength(c.value)}자</span>
            </button>
            <span className="muted small why">{c.why}</span>
          </li>
        ))}
      </ul>
      {draft === null ? (
        <button type="button" className="small" onClick={() => setDraft(chosen ?? items[0]?.value ?? '')}>
          직접 고쳐 쓰기
        </button>
      ) : (
        <div className="editor">
          {multiline ? <textarea rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} /> : <input value={draft} onChange={(e) => setDraft(e.target.value)} />}
          <div className="actions">
            <span className={n > max ? 'error-text small' : 'muted small'}>
              {n}/{max}자
            </span>
            <button type="button" className="primary" disabled={!draft.trim() || n > max} onClick={() => void save({ [field]: draft.trim() }).then((ok) => ok && setDraft(null))}>
              저장
            </button>
            <button type="button" onClick={() => setDraft(null)}>
              그만두기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type Palette = NonNullable<BrandState['visual']>['candidates']['palettes'][number];

function PaletteCard({ p, on, min, save }: { p: Palette; on: boolean; min: number; save: (x: Patch) => Promise<boolean> }) {
  const c = p.colors;
  // 주색 위 글자는 더 잘 읽히는 쪽 (규칙과 같은 기준)
  const onPrimary = contrast(c.text, c.primary) >= contrast(c.background, c.primary) ? c.text : c.background;
  return (
    <button type="button" className={on ? 'palette on' : 'palette'} onClick={() => void save({ palette: { name: p.name, colors: c, why: p.why } })}>
      <div className="swatches">
        {(['primary', 'secondary', 'accent', 'background', 'text'] as const).map((k) => (
          <span key={k} className="swatch" style={{ background: c[k] }} title={`${k} ${c[k]}`} />
        ))}
      </div>
      <div className="sample" style={{ background: c.background, color: c.text }}>
        <span>배경 위 글자</span>
        <span className="sample-band" style={{ background: c.primary, color: onPrimary }}>
          주색 위 글자
        </span>
      </div>
      <strong>{p.name}</strong>
      <span className="small">
        명암비 글자/배경 <b>{p.contrast.textOnBackground.toFixed(2)}:1</b> · 주색 위 <b>{p.contrast.bestOnPrimary.toFixed(2)}:1</b>{' '}
        <span className="muted">(기준 {min}:1)</span>
      </span>
      <span className="muted small">{p.why}</span>
    </button>
  );
}

// 화면 표시용 명암비 (서버 limits.ts 와 같은 식). 어느 색을 주색 위 글자로 보여 줄지 고르는 데만 쓴다
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}

export function BrandPage() {
  const [state, setState] = useState<BrandState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      fetchBrand()
        .then(setState)
        .catch((e: unknown) => setError(`불러오지 못했습니다 (${String(e)}). 서버가 켜져 있는지 확인하고 새로고침하세요.`)),
    [],
  );

  useEffect(() => {
    void refresh();
    void loadBrandFonts();
  }, [refresh]);

  const save = async (patch: Patch): Promise<boolean> => {
    setNotice(null);
    setError(null);
    const r = await api.api.brand.selection.$put({ json: patch });
    const b = await r.json();
    if ('error' in b) {
      setError(b.error);
      return false;
    }
    setNotice('저장했어요.');
    await refresh();
    return true;
  };

  if (!state) return <section className="card">{error ?? '불러오는 중…'}</section>;
  const { activeProfile, words, visual, selection, fonts, limits } = state;
  const stale = (kit: { profileId: number } | null) => kit !== null && activeProfile !== null && kit.profileId !== activeProfile.id;
  const font = (id: string) => fonts.find((f) => f.id === id);

  return (
    <>
      <section className="card">
        <h2>브랜딩 키트</h2>
        {activeProfile ? (
          <p className="muted small">
            기준 프로필: v{activeProfile.version} · {activeProfile.accountLine}
          </p>
        ) : (
          <p className="note">아직 적용 중인 프로필이 없어요. 「정체성」에서 프로필을 만들고 확정한 뒤 키트를 만들 수 있어요.</p>
        )}
        {notice && <p className="status ok small">{notice}</p>}
        {error && <p className="status error">{error}</p>}
      </section>

      <section className="card">
        <h2>아이디 · 표시 이름 · 바이오</h2>
        {stale(words) && <p className="note">이 후보를 만든 뒤 프로필이 바뀌었어요 — 아래 버튼으로 다시 만드세요.</p>}
        <KitJob kind="words" label={words ? '글 후보 다시 만들기' : '글 후보 만들기'} onDone={() => void refresh()} />
        {words && (
          <>
            <TextPick
              title="아이디"
              field="handle"
              items={words.candidates.handles}
              chosen={selection.handle}
              max={limits.handleMax}
              hint="이미 누가 쓰는 아이디인지는 앱이 알 수 없어요. 인스타 프로필 편집에서 직접 입력해 보고 확인하세요."
              save={save}
            />
            <TextPick title="표시 이름" field="displayName" items={words.candidates.displayNames} chosen={selection.displayName} max={limits.displayNameMax} save={save} />
            <TextPick
              title="바이오"
              field="bio"
              items={words.candidates.bios}
              chosen={selection.bio}
              max={limits.bioUsable}
              hint={`인스타 바이오는 ${limits.bioMax}자 — 링크 안내 문구 자리로 ${limits.bioLinkReserve}자를 남겨요. 주소는 바이오가 아니라 링크 칸에 넣어요.`}
              multiline
              save={save}
            />
            <Dropped items={words.dropped} />
          </>
        )}
      </section>

      <section className="card">
        <h2>색 · 폰트 · 그림</h2>
        {stale(visual) && <p className="note">이 후보를 만든 뒤 프로필이 바뀌었어요 — 아래 버튼으로 다시 만드세요.</p>}
        <KitJob kind="visual" label={visual ? '시각 후보 다시 만들기' : '시각 후보 만들기'} onDone={() => void refresh()} />
        {visual && (
          <>
            <h3>색 팔레트</h3>
            <div className="palettes">
              {visual.candidates.palettes.map((p) => (
                <PaletteCard key={p.name} p={p} on={selection.palette?.name === p.name} min={limits.minContrast} save={save} />
              ))}
            </div>

            <h3>폰트 짝 (제목 + 본문)</h3>
            <div className="fontpairs">
              {visual.candidates.fontPairs.map((f) => {
                const t = font(f.title);
                const b = font(f.body);
                const on = selection.titleFont === f.title && selection.bodyFont === f.body;
                return (
                  <button key={`${f.title}+${f.body}`} type="button" className={on ? 'fontpair on' : 'fontpair'} onClick={() => void save({ titleFont: f.title, bodyFont: f.body })}>
                    <span className="font-title" style={{ fontFamily: t?.family, fontWeight: t?.weights.at(-1) }}>
                      {activeProfile?.accountLine ?? '제목 미리보기'}
                    </span>
                    <span className="font-body" style={{ fontFamily: b?.family, fontWeight: b?.weights[0] }}>
                      본문은 이렇게 보여요. 써 보고 정리한 내용을 한 장에 담습니다. 0123456789
                    </span>
                    <span className="muted small">
                      {t?.name} + {b?.name} · {f.why}
                    </span>
                    <span className="muted small">
                      라이선스: {[t, b].filter((x, i, a) => x && a.indexOf(x) === i).map((x) => `${x!.name} — ${x!.license.name}${x!.license.reservedFontName ? ` (예약 이름 "${x!.license.reservedFontName}")` : ''}`).join(' · ')}
                    </span>
                  </button>
                );
              })}
            </div>

            <h3>그림 프롬프트</h3>
            <p className="muted small">그림 생성 도구에 붙여 넣어 쓰세요. 만든 그림은 아래 「프로필 사진」에서 올리면 그대로 적용돼요.</p>
            <ul className="prompts">
              {visual.candidates.imagePrompts.map((p) => (
                <li key={p.filename}>
                  <strong>{p.target === 'profile' ? '프로필 사진' : `하이라이트 커버 · ${p.label}`}</strong> <span className="muted small">{p.filename}</span>
                  <pre>{p.prompt}</pre>
                  <button type="button" className="small" onClick={() => void navigator.clipboard.writeText(p.prompt).then(() => setNotice('프롬프트를 복사했어요.'))}>
                    복사
                  </button>
                </li>
              ))}
            </ul>
            <Dropped items={visual.dropped} />
          </>
        )}
      </section>

      <ProfileImage selection={selection} fonts={fonts} save={save} />
    </>
  );
}
