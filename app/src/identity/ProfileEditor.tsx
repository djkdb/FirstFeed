// 프로필 직접 수정 (FR-ID-5). 저장하면 새 판이 바로 활성이 된다. 고치던 내용은 이 브라우저에 임시 저장 — 새로고침해도 날아가지 않게.
import { useEffect, useState } from 'react';
import { api } from '../api.ts';
import type { Profile } from './types.ts';

interface Draft {
  accountLine: string;
  audience: string;
  pillars: Array<{ id?: string; name: string; description: string }>;
  voiceRules: string[];
  avoid: string[];
  presence: string;
}

const key = (id: number) => `firstfeed.profileEdit.${id}`;

function fromProfile(p: Profile): Draft {
  return {
    accountLine: p.accountLine,
    audience: p.audience,
    pillars: p.pillars.map((x) => ({ id: x.id, name: x.name, description: x.description })),
    voiceRules: p.voiceRules.map((v) => v.text),
    avoid: p.avoid.map((v) => v.text),
    presence: p.presence?.text ?? '',
  };
}

function readDraft(p: Profile): Draft {
  try {
    const raw = localStorage.getItem(key(p.id));
    return raw ? (JSON.parse(raw) as Draft) : fromProfile(p);
  } catch {
    return fromProfile(p);
  }
}

export function hasEditDraft(id: number): boolean {
  try {
    return localStorage.getItem(key(id)) !== null;
  } catch {
    return false;
  }
}

export function ProfileEditor({ profile, onDone }: { profile: Profile; onDone: (saved: boolean, notes?: string[]) => void }) {
  const [d, setD] = useState<Draft>(() => readDraft(profile));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(key(profile.id), JSON.stringify(d));
    } catch {
      /* 임시 저장 없이 동작 */
    }
  }, [d, profile.id]);

  const patch = (change: (cur: Draft) => Draft) => setD((cur) => change(cur));
  const list = (field: 'voiceRules' | 'avoid', label: string) => (
    <div>
      <h4>{label}</h4>
      {d[field].map((v, i) => (
        <div key={i} className="row">
          <input value={v} maxLength={80} onChange={(e) => patch((c) => ({ ...c, [field]: c[field].map((x, j) => (j === i ? e.target.value : x)) }))} />
          <button type="button" onClick={() => patch((c) => ({ ...c, [field]: c[field].filter((_, j) => j !== i) }))}>
            빼기
          </button>
        </div>
      ))}
      <button type="button" onClick={() => patch((c) => ({ ...c, [field]: [...c[field], ''] }))}>
        + 더하기
      </button>
    </div>
  );

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        accountLine: d.accountLine,
        audience: d.audience,
        pillars: d.pillars,
        voiceRules: d.voiceRules.filter((v) => v.trim()),
        avoid: d.avoid.filter((v) => v.trim()),
        presence: d.presence.trim() || null,
      };
      const r = await api.api.identity.profiles[':id'].$put({ param: { id: String(profile.id) }, json: body });
      const res = await r.json();
      if ('error' in res) throw new Error(res.error);
      localStorage.removeItem(key(profile.id));
      onDone(true, [`바뀐 점: ${res.changes.join(', ')}`, ...res.warnings]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    try {
      localStorage.removeItem(key(profile.id));
    } catch {
      /* 없음 */
    }
    onDone(false);
  };

  return (
    <div className="editor">
      <p className="muted small">고친 내용은 저장하면 새 판이 되어 바로 적용됩니다. 언제든 이전 판으로 되돌릴 수 있어요.</p>
      <label>
        계정 소개 (30자)
        <input value={d.accountLine} maxLength={30} onChange={(e) => patch((c) => ({ ...c, accountLine: e.target.value }))} />
      </label>
      <label>
        보는 사람
        <input value={d.audience} maxLength={100} onChange={(e) => patch((c) => ({ ...c, audience: e.target.value }))} />
      </label>
      <label>
        보여 주는 방식 (얼굴 노출·캐릭터)
        <input value={d.presence} maxLength={100} onChange={(e) => patch((c) => ({ ...c, presence: e.target.value }))} />
      </label>
      <h4>콘텐츠 축</h4>
      {d.pillars.map((p, i) => (
        <div key={p.id ?? `new-${i}`} className="pillar-edit">
          <input value={p.name} maxLength={20} placeholder="축 이름" onChange={(e) => patch((c) => ({ ...c, pillars: c.pillars.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) }))} />
          <input
            value={p.description}
            maxLength={100}
            placeholder="이 축에서 올릴 것 한 문장"
            onChange={(e) => patch((c) => ({ ...c, pillars: c.pillars.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) }))}
          />
          <button type="button" onClick={() => patch((c) => ({ ...c, pillars: c.pillars.filter((_, j) => j !== i) }))}>
            축 빼기
          </button>
          {!p.id && <span className="tag">직접 추가</span>}
        </div>
      ))}
      {d.pillars.length < 5 && (
        <button type="button" onClick={() => patch((c) => ({ ...c, pillars: [...c.pillars, { name: '', description: '' }] }))}>
          + 축 더하기
        </button>
      )}
      {list('voiceRules', '말투 규칙')}
      {list('avoid', '피할 것')}
      {error && <p className="status error">{error}</p>}
      <div className="actions">
        <button type="button" className="primary" disabled={busy} onClick={() => void save()}>
          {busy ? '저장하는 중…' : '저장 (새 판으로 바로 적용)'}
        </button>
        <button type="button" disabled={busy} onClick={cancel}>
          취소
        </button>
      </div>
    </div>
  );
}
