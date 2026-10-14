// 브랜드 프로필 초안 (FR-ID-4): 축마다 원문 인용과 출처. 근거 부족으로 뺀 축도 숨기지 않고 보여 준다.
import type { Profile } from './types.ts';

export function ProfileView({ profile, active, busy, onConfirm }: { profile: Profile; active: boolean; busy: boolean; onConfirm: () => void }) {
  return (
    <div className="profile">
      <div className="profile-head">
        <div>
          <p className="muted small">브랜드 프로필 v{profile.version}</p>
          <h3 className="account-line">{profile.accountLine}</h3>
          <p>
            <span className="muted">보는 사람 · </span>
            {profile.audience}
          </p>
        </div>
        {active ? (
          <span className="badge ok">확정됨</span>
        ) : (
          <button type="button" className="primary" disabled={busy} onClick={onConfirm}>
            이 프로필로 확정
          </button>
        )}
      </div>

      <h4>콘텐츠 축</h4>
      <div className="pillars">
        {profile.pillars.map((p) => (
          <div key={p.name} className="pillar">
            <strong>{p.name}</strong>
            <p>{p.description}</p>
            {p.evidence.map((e, i) => (
              <blockquote key={i}>
                “{e.quote}”
                <span className="source">
                  {e.sourceLabel}
                  {e.weight === 'supporting' && <span className="tag">보조 근거</span>}
                </span>
              </blockquote>
            ))}
          </div>
        ))}
      </div>

      {profile.dropped.length > 0 && (
        <>
          <h4>근거 부족</h4>
          <ul className="dropped">
            {profile.dropped.map((d) => (
              <li key={d.name}>
                <strong>{d.name}</strong> — {d.description} <span className="muted">({d.reason})</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="profile-lists">
        <div>
          <h4>말투 규칙</h4>
          <ul>{profile.voiceRules.map((v) => <li key={v}>{v}</li>)}</ul>
        </div>
        <div>
          <h4>피할 것</h4>
          <ul>{profile.avoid.map((v) => <li key={v}>{v}</li>)}</ul>
        </div>
        {profile.unknown.length > 0 && (
          <div>
            <h4>아직 모르는 것</h4>
            <ul>{profile.unknown.map((v) => <li key={v}>{v}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}
