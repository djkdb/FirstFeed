import { describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { applyEdit, rollbackTo, saveEdit, type EditInput } from './edit.ts';
import { text, userAuthoredTexts, type ProfileContent } from './model.ts';
import { profileRules, type ProfileDraft } from './profile.ts';
import { buildSources } from './sources.ts';
import { activeProfile, listProfiles, saveProfileVersion } from './store.ts';

const base: ProfileContent = {
  accountLine: '학생에게 써 본 AI 도구 정리',
  accountLineOrigin: 'interview',
  audience: 'AI 도구를 막 쓰기 시작한 대학생',
  audienceOrigin: 'interview',
  pillars: [
    { id: 'aaaaaaaaaaaaaaaa', name: '써 보고 정리', description: '써 본 도구 정리', evidence: [{ quote: 'q1', source: 'A1', sourceLabel: '인터뷰 1번 답', weight: 'primary' }], origin: 'interview', expiresAt: null },
    { id: 'bbbbbbbbbbbbbbbb', name: '오늘 바로', description: '그날 해 볼 것', evidence: [{ quote: 'q2', source: 'A2', sourceLabel: '인터뷰 2번 답', weight: 'primary' }], origin: 'interview', expiresAt: null },
    { id: 'cccccccccccccccc', name: '대외활동', description: '활동 기록', evidence: [{ quote: 'q3', source: 'A3', sourceLabel: '인터뷰 3번 답', weight: 'primary' }], origin: 'interview', expiresAt: null },
  ],
  dropped: [],
  voiceRules: [text('쉽게 쓴다', 'interview'), text('확인한 것만', 'interview')],
  avoid: [text('과장된 제목', 'interview')],
  unknown: ['게시물 형식'],
  presence: { text: '안 한다 — 캐릭터로 대신한다', source: 'S6', origin: 'interview' },
};
const asInput = (c: ProfileContent): EditInput => ({
  accountLine: c.accountLine,
  audience: c.audience,
  pillars: c.pillars.map((p) => ({ id: p.id, name: p.name, description: p.description })),
  voiceRules: c.voiceRules.map((v) => v.text),
  avoid: c.avoid.map((v) => v.text),
  presence: c.presence?.text ?? null,
});

describe('프로필 직접 수정 (FR-ID-5)', () => {
  it('고친 칸만 출처가 edit 이 되고, 고치지 않은 칸은 출처를 그대로 둔다', () => {
    const input = asInput(base);
    input.accountLine = '학생에게 Notion 과 AI 도구 정리';
    input.voiceRules = ['쉽게 쓴다', '주 3회 Notion 으로 정리한다'];
    const r = applyEdit(base, input);
    expect(r.content.accountLineOrigin).toBe('edit');
    expect(r.content.audienceOrigin).toBe('interview');
    expect(r.content.voiceRules).toEqual([text('쉽게 쓴다', 'interview'), text('주 3회 Notion 으로 정리한다', 'edit')]);
    expect(r.changes).toEqual(['계정 소개', '말투 규칙']);
  });

  it('축을 고쳐도 같은 ID·근거를 유지하고 고친 칸을 기록한다. 새 축은 새 ID 와 「직접 추가한 축」 근거, 뺀 축은 바뀐 점에 남는다', () => {
    const input = asInput(base);
    input.pillars[0]!.description = '써 본 도구를 Notion 템플릿으로 정리';
    input.pillars.splice(2, 1); // 대외활동 삭제
    input.pillars.push({ name: '캐릭터 일상', description: 'ZUN 캐릭터로 보여 주는 개발 일상' });
    const r = applyEdit(base, input);
    const [p0, p1, p2] = r.content.pillars;
    expect(p0).toMatchObject({ id: 'aaaaaaaaaaaaaaaa', origin: 'interview', edited: ['description'], evidence: base.pillars[0]!.evidence });
    expect(p1).toEqual(base.pillars[1]);
    expect(p2!.id).toMatch(/^[0-9a-f]{16}$/);
    expect(p2!.id).not.toBe('cccccccccccccccc'); // 지운 축의 ID 를 다시 쓰지 않는다
    expect(p2).toMatchObject({ origin: 'edit', evidence: [{ source: 'U', sourceLabel: '직접 추가한 축', weight: 'primary' }] });
    expect(r.changes).toEqual(['축 수정 "써 보고 정리"', '축 추가 "캐릭터 일상"', '축 삭제 "대외활동"']);
  });

  it('축이 3개 미만이면 막지는 않고 경고한다', () => {
    const input = asInput(base);
    input.pillars = input.pillars.slice(0, 2);
    expect(applyEdit(base, input).warnings[0]).toMatch(/3개 이상/);
  });

  it('바뀐 것이 없으면 저장하지 않는다', () => {
    const db = openDb(':memory:');
    const id = saveProfileVersion(db, 1, base, { reason: 'interview', sessionId: null, basedOn: null, jobId: null, activate: true });
    expect(() => saveEdit(db, id, asInput(base))).toThrow(/바뀐 것이 없습니다/);
  });
});

describe('수정 이력과 되돌리기 (FR-ID-5 수용 기준: 수정 이력이 남고 이전 판으로 되돌릴 수 있다)', () => {
  it('수정은 새 판으로 바로 활성, 되돌리기는 옛 판을 복사한 새 판으로 바로 활성 — 옛 판은 모두 남는다', () => {
    const db = openDb(':memory:');
    const v1 = saveProfileVersion(db, 1, base, { reason: 'interview', sessionId: null, basedOn: null, jobId: null, activate: true });
    const input = asInput(base);
    input.accountLine = '바꾼 계정 소개';
    const { profileId: v2 } = saveEdit(db, v1, input);
    expect(activeProfile(db, 1)?.id).toBe(v2);
    expect(activeProfile(db, 1)).toMatchObject({ reason: 'edit', basedOn: v1, accountLine: '바꾼 계정 소개' });

    const v3 = rollbackTo(db, v1);
    const active = activeProfile(db, 1)!;
    expect(active.id).toBe(v3);
    expect(active).toMatchObject({ reason: 'rollback', basedOn: v1, version: 3, accountLine: base.accountLine });
    expect(active.pillars.map((p) => p.id)).toEqual(base.pillars.map((p) => p.id)); // 축 ID 유지
    expect(listProfiles(db, 1).map((p) => [p.version, p.reason])).toEqual([
      [3, 'rollback'],
      [2, 'edit'],
      [1, 'interview'],
    ]);
  });
});

describe('사용자가 직접 쓴 글 vs AI 가 만들거나 다듬은 글 (허용 출처 4번)', () => {
  // 다른 방향을 만들 때: 숫자·영문 대조의 허용 출처 = 사용자 답 + 지금 판에서 사용자가 직접 쓴 글
  const sources = buildSources({ S2: { choices: ['IT·AI'] } }, [
    { turnNo: 1, question: '계기는?', answer: '써 보고 알게 된 걸 정리해 두면 도움이 되겠다 싶었다', answerKind: 'text' },
  ]);
  const draft = (description: string): ProfileDraft => ({
    account_line: '학생에게 도구 정리',
    audience: '대학생',
    pillars: [{ name: '정리', description, evidence: [{ quote: '써 보고 알게 된 걸 정리해 두면', source: 'A1' }] }],
    voice_rules: ['a', 'b', 'c'],
    avoid: [],
    unknown: [],
  });
  const codes = (d: ProfileDraft, extra: string[]) =>
    profileRules({ sources, overlapThreshold: 0.5, minQuoteChars: 4, commonTerms: [], extraUserTexts: extra })
      .flatMap((r) => r(d))
      .map((i) => i.code);

  it('사용자가 수정으로 새로 쓴 숫자·영문 이름은 통과한다', () => {
    const input = asInput(base);
    input.voiceRules = ['주 3회 Notion 으로 정리한다'];
    const edited = applyEdit(base, input).content;
    expect(userAuthoredTexts(edited)).toEqual(['주 3회 Notion 으로 정리한다']);
    expect(codes(draft('Notion 템플릿으로 주 3회 정리'), userAuthoredTexts(edited))).toEqual([]);
  });

  it('같은 글이라도 AI 가 만들었거나(interview) 다시 다듬은(alternative) 것이면 허용 출처가 아니다', () => {
    for (const origin of ['interview', 'alternative'] as const) {
      const aiMade: ProfileContent = { ...base, voiceRules: [text('주 3회 Notion 으로 정리한다', origin)] };
      expect(userAuthoredTexts(aiMade)).toEqual([]);
      expect(codes(draft('Notion 템플릿으로 주 3회 정리'), userAuthoredTexts(aiMade))).toEqual(
        expect.arrayContaining(['english_not_in_source', 'number_not_in_source']),
      );
    }
  });

  it('AI 축에서 사용자가 고친 칸만 사용자 글이다 (안 고친 이름은 아니다)', () => {
    const input = asInput(base);
    input.pillars[0]!.description = 'Cursor 로 만든 것 정리';
    const c = applyEdit(base, input).content;
    expect(userAuthoredTexts(c)).toEqual(['Cursor 로 만든 것 정리']);
  });
});
