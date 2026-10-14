// 확정(활성) 프로필 → 이후 모든 생성의 입력 (FR-ID-6: "확정한 프로필은 이후 모든 생성의 입력이 된다 (말투·축·피할 것)").
// 브랜딩 키트·카드·캡션·릴스·발굴은 프로필을 직접 읽지 않고 반드시 여기를 거친다 — 한 곳에서 모양을 정해야
// "프로필을 바꾸면 이후 생성 결과에 반영된다"가 모든 생성에서 똑같이 지켜진다.
import type { Db } from '../db/index.ts';
import { activeProfile } from './store.ts';
import { FlowError } from './flow.ts';

export interface ProfileInput {
  profileId: number;
  version: number;
  accountLine: string;
  audience: string;
  /** 축 ID 는 콘텐츠가 어느 축인지 기록하는 데 쓴다 (성과 단계의 축별 통계) */
  pillars: Array<{ id: string; name: string; description: string }>;
  voiceRules: string[];
  avoid: string[];
  /** 「보여 주는 방식」 — 프로필 사진·커버 프롬프트(FR-BR-4) */
  presence: string | null;
  /** 아직 모르는 것 — 생성에서 지어내지 말고 비워 둘 것들 */
  unknown: string[];
}

export function profileForGeneration(db: Db, brandId: number): ProfileInput {
  const p = activeProfile(db, brandId);
  if (!p) throw new FlowError('적용 중인 브랜드 프로필이 없습니다.', '「정체성」에서 프로필을 만들고 확정한 뒤 다시 시도하세요.');
  return {
    profileId: p.id,
    version: p.version,
    accountLine: p.accountLine,
    audience: p.audience,
    pillars: p.pillars.map((x) => ({ id: x.id, name: x.name, description: x.description })),
    voiceRules: p.voiceRules.map((v) => v.text),
    avoid: p.avoid.map((v) => v.text),
    presence: p.presence?.text ?? null,
    unknown: p.unknown,
  };
}

/** 생성 프롬프트에 넣는 프로필 블록 (모든 생성이 같은 모양으로 받는다) */
export function formatProfileForPrompt(p: ProfileInput): string {
  return [
    `계정 소개: ${p.accountLine}`,
    `보는 사람: ${p.audience}`,
    '콘텐츠 축:',
    ...p.pillars.map((x) => `- [${x.id}] ${x.name}: ${x.description}`),
    '말투 규칙:',
    ...p.voiceRules.map((v) => `- ${v}`),
    '피할 것:',
    ...(p.avoid.length ? p.avoid.map((v) => `- ${v}`) : ['- (없음)']),
    `보여 주는 방식: ${p.presence ?? '(정하지 않음)'}`,
    `아직 모르는 것(지어내지 말 것): ${p.unknown.length ? p.unknown.join(' / ') : '(없음)'}`,
  ].join('\n');
}

/** 근거 대조의 허용 출처 2번(브랜드 프로필)으로 쓸 글 */
export function profileGroundingTexts(p: ProfileInput): string[] {
  return [p.accountLine, p.audience, ...p.pillars.flatMap((x) => [x.name, x.description]), ...p.voiceRules, ...p.avoid, ...(p.presence ? [p.presence] : [])];
}
