// 저장되는 브랜드 프로필의 모양 (FR-ID-4·5·6). 결정: CLAUDE.md 2026-10-14 · FR-ID-5·6 설계
// - 출처(origin)는 항목 단위 (PRD 5장은 프로필 단위 — 다른 결정)
// - 축마다 고정 ID: 수정·되돌리기는 유지, 다른 방향에서 고른 축은 새 ID (기존 축과 이어 붙이지 않는다)
// - 만료일(expiresAt)은 칸만 둔다. 자동으로 빼는 로직은 FR-IN-6(F) 때
import { randomBytes } from 'node:crypto';

/** 항목이 어디서 왔는가 */
export type ItemOrigin = 'interview' | 'edit' | 'insight' | 'alternative';
/** 판이 왜 생겼는가 */
export type VersionReason = 'interview' | 'edit' | 'alternative' | 'rollback';

export interface StoredEvidence {
  quote: string;
  /** S1~S8 · A1~A10 · U(사용자가 직접 추가한 축) */
  source: string;
  sourceLabel: string;
  weight: 'primary' | 'supporting';
}

export interface StoredPillar {
  id: string;
  name: string;
  description: string;
  evidence: StoredEvidence[];
  /** 축이 생긴 경로: interview(인터뷰 초안) · alternative(다른 방향) · edit(사용자가 직접 추가) · insight(성과, F) */
  origin: ItemOrigin;
  /** AI 가 만든 축에서 사용자가 직접 고친 칸 — 고친 칸의 글만 "사용자가 직접 입력한 문장"이다 */
  edited?: Array<'name' | 'description'>;
  expiresAt: string | null;
}

export interface StoredText {
  text: string;
  origin: ItemOrigin;
  expiresAt: string | null;
}

/** 「보여 주는 방식」(얼굴 노출·캐릭터). 설문 S6 을 코드가 그대로 옮긴 것 — AI 생성이 아니다 */
export interface Presence {
  text: string;
  source: 'S6' | 'edit';
  origin: ItemOrigin;
}

export interface DroppedPillar {
  name: string;
  description: string;
  reason: string;
}

/** 판 하나의 내용 (저장·되돌리기·다른 방향이 모두 이 모양을 주고받는다) */
export interface ProfileContent {
  accountLine: string;
  accountLineOrigin: ItemOrigin;
  audience: string;
  audienceOrigin: ItemOrigin;
  pillars: StoredPillar[];
  dropped: DroppedPillar[];
  voiceRules: StoredText[];
  avoid: StoredText[];
  unknown: string[];
  presence: Presence | null;
}

/** 축 ID: 16자리 16진수 (마이그레이션 004 의 lower(hex(randomblob(8))) 와 같은 모양) */
export function newPillarId(): string {
  return randomBytes(8).toString('hex');
}

export const text = (t: string, origin: ItemOrigin): StoredText => ({ text: t, origin, expiresAt: null });

/**
 * 사용자가 직접 쓴 글 (허용 출처 4번). 출처가 edit 인 항목, AI 축에서 사용자가 고친 칸, 사용자가 추가한 축만.
 * 같은 칸이라도 AI 가 만들거나 다시 다듬은 글(interview·alternative)은 들어가지 않는다.
 */
export function userAuthoredTexts(c: ProfileContent): string[] {
  const out: string[] = [];
  if (c.accountLineOrigin === 'edit') out.push(c.accountLine);
  if (c.audienceOrigin === 'edit') out.push(c.audience);
  for (const p of c.pillars) {
    if (p.origin === 'edit') out.push(p.name, p.description);
    else {
      if (p.edited?.includes('name')) out.push(p.name);
      if (p.edited?.includes('description')) out.push(p.description);
    }
  }
  for (const t of [...c.voiceRules, ...c.avoid]) if (t.origin === 'edit') out.push(t.text);
  if (c.presence?.origin === 'edit') out.push(c.presence.text);
  return out;
}
