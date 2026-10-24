// AI 대기 단계 표시 (결정 2026-10-24): 서버가 알려 준 「지금 실제로 들어선 단계」(server/src/ai/adapter.ts JobStage)만 사람 말로 옮긴다.
// 진행 막대 · 남은 시간 짐작은 만들지 않는다 — 루프가 어디에 있는지 모르는 것을 아는 척하지 않으려고
export interface Stage {
  step: 'queued' | 'generate' | 'rules' | 'late' | 'review' | 'rewrite' | 'json_retry';
  task: string;
  call: number;
  since: string;
  reasons: string[];
}

/** 처음 쓸 때 과제마다 무엇을 하는지 */
const WRITING: Record<string, string> = {
  identity_profile: '답변에서 축 찾는 중',
  identity_followup: '다음 질문 고르는 중',
  identity_alternatives: '다른 방향 두 개 찾는 중',
  brand_words: '아이디 · 이름 · 바이오 후보 쓰는 중',
  brand_visual: '색 · 글꼴 · 그림 프롬프트 고르는 중',
  cover_titles: '표지 제목 후보 쓰는 중',
  card_body: '본문 카드 쓰는 중',
  caption_min: '캡션 쓰는 중',
  series_plan: '첫 9개 게시물 제목 계획하는 중',
  smoke_extract: '원문에서 사실 뽑는 중',
};

/** 코드 규칙 단계에서 과제마다 무엇을 대조하는지 */
const CHECKING: Record<string, string> = {
  identity_profile: '근거 확인 중 — 축마다 붙은 인용이 내 답에 실제로 있는지',
  identity_followup: '규칙 확인 중 — 앞 질문과 겹치지 않는지',
  brand_visual: '규칙 확인 중 — 명암비 · 앱에 있는 글꼴 · 그림 프롬프트 규칙',
  series_plan: '규칙 확인 중 — 글자 수 · 축 · 숫자 근거 · 거의 같은 제목',
};

/** 이유 한 줄은 이만큼만 — 화면 한 줄에 들어가게 */
const REASON_MAX = 80;
const clip = (s: string) => ([...s].length > REASON_MAX ? `${[...s].slice(0, REASON_MAX - 1).join('')}…` : s);

export interface StageText {
  text: string;
  reasons: string[];
}

export function stageText(stage: Stage | null | undefined): StageText | null {
  if (!stage) return null;
  const nth = stage.call > 0 ? ` (${stage.call}번째 AI 호출)` : '';
  const reasons = stage.reasons.slice(0, 3).map(clip);
  switch (stage.step) {
    case 'queued':
      return { text: '앞 작업이 끝나기를 기다리는 중 — AI 는 한 번에 하나씩 불러요', reasons: [] };
    case 'generate':
      return { text: `${WRITING[stage.task] ?? 'AI 가 쓰는 중'}${nth}`, reasons: [] };
    case 'rules':
      return { text: CHECKING[stage.task] ?? '근거 확인 중 — 숫자 · 영문 이름이 답 · 원문에 있는지 코드가 대조', reasons: [] };
    case 'late':
      return { text: '카드에 그려 보고 글이 넘치지 않는지 확인 중', reasons: [] };
    case 'review':
      return { text: `다른 눈으로 다시 읽는 중 — 사실 오류 · 깨진 곳이 없는지(자기 평가)${nth}`, reasons: [] };
    case 'rewrite':
      return { text: `다시 쓰는 중${nth} — 걸린 이유:`, reasons };
    case 'json_retry':
      return { text: `답 형식이 깨져 다시 요청하는 중${nth}`, reasons };
  }
}
