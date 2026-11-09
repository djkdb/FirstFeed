// 다음 단계 안내 — 한 단계를 끝낸 자리에서 어디로 가면 되는지(사용자 시뮬레이션 2026-11-09: 프로필 확정 · 템플릿 고정 뒤 다음 할 일이 안 보였다)
const STEPS = [
  { key: 'identity', href: '#/identity', label: '정체성 찾기', what: '설문과 인터뷰로 계정의 축 · 말투를 정해요' },
  { key: 'brand', href: '#/brand', label: '브랜드 만들기', what: '아이디 · 바이오 · 색 · 글꼴을 골라요' },
  { key: 'template', href: '#/template', label: '템플릿 고정', what: '카드가 나올 틀 하나를 골라 고정해요' },
  { key: 'make', href: '#/make', label: '첫 카드뉴스 만들기', what: '소재를 붙여 넣으면 카드 세트가 나와요' },
  { key: 'preview', href: '#/preview', label: '30일 뒤 미리보기', what: '첫 9개 게시물 계획을 세워 홈에 일정이 생겨요' },
] as const;
export type StepKey = (typeof STEPS)[number]['key'];

/** after 단계를 막 끝냈을 때 보일 「다음: …」 한 줄 */
export function NextStep({ after }: { after: StepKey }) {
  const i = STEPS.findIndex((s) => s.key === after);
  const next = STEPS[i + 1];
  if (!next) return null;
  return (
    <p className="next-step">
      다음 단계 · <a href={next.href}>{next.label} →</a> <span className="muted small">{next.what}</span>
    </p>
  );
}

/** 처음 쓰는 사람의 홈: 단계 목록 + 지금 할 단계 단추. progress 는 작업 콘솔과 같은 판정(server/src/console/feed.ts progressOf) */
export function StartChecklist({ progress }: { progress: Partial<Record<StepKey, boolean>> | null }) {
  const firstTodo = STEPS.find((s) => !progress?.[s.key]);
  return (
    <div className="start-list">
      <ol>
        {STEPS.map((s) => (
          <li key={s.key} className={progress?.[s.key] ? 'done' : s === firstTodo ? 'now' : ''}>
            <span className="start-mark" aria-hidden="true">{progress?.[s.key] ? '✓' : STEPS.indexOf(s) + 1}</span>
            <span>
              <a href={s.href}>{s.label}</a> <span className="muted small">{s.what}</span>
            </span>
          </li>
        ))}
      </ol>
      {firstTodo && (
        <a className="button primary" href={firstTodo.href}>
          {progress?.identity ? `이어서 · ${firstTodo.label}` : '정체성부터 시작하기'}
        </a>
      )}
    </div>
  );
}
