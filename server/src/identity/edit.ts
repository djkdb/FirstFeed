// 프로필 직접 수정과 되돌리기 (FR-ID-5). 결정: CLAUDE.md 2026-10-14 · FR-ID-5·6 설계
// - 저장하면 새 판, 바로 활성. 되돌리기도 옛 판을 복사한 새 판 (옛 판은 지우지 않는다)
// - 축 ID: 수정·되돌리기에서 유지. 사용자가 새로 더한 축만 새 ID
// - 사용자가 고친 칸은 출처 edit — "사용자가 직접 입력한 문장"(허용 출처 4번). 고치지 않은 칸은 출처를 그대로 둔다
import { z } from 'zod';
import type { Db } from '../db/index.ts';
import { newPillarId, text, type ProfileContent, type StoredPillar, type StoredText } from './model.ts';
import { getProfile, saveProfileVersion } from './store.ts';

export const EditInput = z.object({
  accountLine: z.string().trim().min(1).max(30),
  audience: z.string().trim().min(1).max(100),
  /** id 가 있으면 기존 축, 없으면 사용자가 새로 더한 축 */
  pillars: z
    .array(z.object({ id: z.string().optional(), name: z.string().trim().min(1).max(20), description: z.string().trim().min(1).max(100) }))
    .min(1)
    .max(5),
  voiceRules: z.array(z.string().trim().min(1).max(80)).max(6),
  avoid: z.array(z.string().trim().min(1).max(80)).max(8),
  presence: z.string().trim().max(100).nullable(),
});
export type EditInput = z.infer<typeof EditInput>;

export class EditError extends Error {
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = 'EditError';
    this.hint = hint;
  }
}

/** 문장 목록: 같은 글이 기존에 있으면 그 항목(출처·만료일)을 그대로, 새 글이면 출처 edit */
function mergeTexts(base: StoredText[], next: string[]): StoredText[] {
  const pool = [...base];
  return next.map((t) => {
    const i = pool.findIndex((b) => b.text === t);
    if (i >= 0) return pool.splice(i, 1)[0]!;
    return text(t, 'edit');
  });
}

export interface EditResult {
  content: ProfileContent;
  changes: string[];
  warnings: string[];
}

/** 직전 판 + 사용자가 원하는 상태 → 새 판 내용과 바뀐 점 요약 */
export function applyEdit(base: ProfileContent, input: EditInput): EditResult {
  const changes: string[] = [];
  const warnings: string[] = [];
  const accountLineChanged = input.accountLine !== base.accountLine;
  const audienceChanged = input.audience !== base.audience;
  if (accountLineChanged) changes.push('계정 소개');
  if (audienceChanged) changes.push('보는 사람');

  const byId = new Map(base.pillars.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const pillars: StoredPillar[] = input.pillars.map((p) => {
    const prev = p.id ? byId.get(p.id) : undefined;
    if (!prev || seen.has(prev.id)) {
      // 사용자가 새로 더한 축: 근거는 사용자가 쓴 그 문장 자체 (「직접 추가한 축」)
      changes.push(`축 추가 "${p.name}"`);
      return {
        id: newPillarId(),
        name: p.name,
        description: p.description,
        evidence: [{ quote: p.description, source: 'U', sourceLabel: '직접 추가한 축', weight: 'primary' }],
        origin: 'edit',
        expiresAt: null,
      };
    }
    seen.add(prev.id);
    const edited = new Set(prev.edited ?? []);
    if (p.name !== prev.name) edited.add('name');
    if (p.description !== prev.description) edited.add('description');
    if (p.name !== prev.name || p.description !== prev.description) changes.push(`축 수정 "${prev.name}"`);
    // ID·근거·출처는 그대로 — 같은 축이다 (성과 단계의 축별 통계가 이어지도록)
    return { ...prev, name: p.name, description: p.description, ...(edited.size ? { edited: [...edited] } : {}) };
  });
  for (const prev of base.pillars) if (!seen.has(prev.id)) changes.push(`축 삭제 "${prev.name}"`);
  if (pillars.length < 3) warnings.push(`콘텐츠 축이 ${pillars.length}개입니다. 계정 색깔이 흐려지지 않게 3개 이상을 권합니다.`);

  const voiceRules = mergeTexts(base.voiceRules, input.voiceRules);
  const avoid = mergeTexts(base.avoid, input.avoid);
  if (JSON.stringify(voiceRules.map((v) => v.text)) !== JSON.stringify(base.voiceRules.map((v) => v.text))) changes.push('말투 규칙');
  if (JSON.stringify(avoid.map((v) => v.text)) !== JSON.stringify(base.avoid.map((v) => v.text))) changes.push('피할 것');

  const presenceText = input.presence?.trim() || null;
  let presence = base.presence;
  if (presenceText !== (base.presence?.text ?? null)) {
    presence = presenceText ? { text: presenceText, source: 'edit', origin: 'edit' } : null;
    changes.push('보여 주는 방식');
  }

  return {
    content: {
      accountLine: input.accountLine,
      accountLineOrigin: accountLineChanged ? 'edit' : base.accountLineOrigin,
      audience: input.audience,
      audienceOrigin: audienceChanged ? 'edit' : base.audienceOrigin,
      pillars,
      dropped: base.dropped,
      voiceRules,
      avoid,
      unknown: base.unknown,
      presence,
    },
    changes,
    warnings,
  };
}

/** 수정 저장: 새 판, 바로 활성 */
export function saveEdit(db: Db, baseId: number, input: EditInput): { profileId: number } & EditResult {
  const base = getProfile(db, baseId);
  if (!base) throw new EditError('고칠 프로필을 찾지 못했습니다.', '화면을 새로고침한 뒤 다시 시도하세요.');
  const r = applyEdit(base, input);
  if (r.changes.length === 0) throw new EditError('바뀐 것이 없습니다.', '고칠 칸을 바꾼 뒤 저장하세요.');
  const profileId = saveProfileVersion(db, base.brandId, r.content, { reason: 'edit', sessionId: base.sessionId, basedOn: base.id, jobId: null, activate: true });
  return { profileId, ...r };
}

/** 되돌리기: 옛 판 내용을 그대로 복사한 새 판 (축 ID·항목 출처 유지), 바로 활성 */
export function rollbackTo(db: Db, targetId: number): number {
  const target = getProfile(db, targetId);
  if (!target) throw new EditError('되돌릴 판을 찾지 못했습니다.', '이력 목록을 새로고침한 뒤 다시 시도하세요.');
  const content: ProfileContent = {
    accountLine: target.accountLine,
    accountLineOrigin: target.accountLineOrigin,
    audience: target.audience,
    audienceOrigin: target.audienceOrigin,
    pillars: target.pillars,
    dropped: target.dropped,
    voiceRules: target.voiceRules,
    avoid: target.avoid,
    unknown: target.unknown,
    presence: target.presence,
  };
  return saveProfileVersion(db, target.brandId, content, { reason: 'rollback', sessionId: target.sessionId, basedOn: target.id, jobId: null, activate: true });
}
