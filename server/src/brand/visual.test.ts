import { describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider, type FakeStep } from '../ai/testing/fake-provider.ts';
import { text, type ProfileContent } from '../identity/model.ts';
import { createSession, saveProfileVersion } from '../identity/store.ts';
import { latestKit } from './store.ts';
import type { VisualCandidates } from './types.ts';
import { enoughAfterDropping, generateVisual, pickVisual, visualRules, type VisualOutput } from './visual.ts';

const pal = (name: string, primary: string, background = '#ffffff', textColor = '#111111') => ({
  name,
  colors: { primary, secondary: '#cccccc', accent: '#ff8800', background, text: textColor },
  why: '이유',
});
const base: VisualOutput = {
  palettes: [pal('밤하늘', '#1a2a6c'), pal('숲', '#1e5631'), pal('벽돌', '#8b2e16'), pal('잉크', '#222222')],
  font_pairs: [
    { title: 'paperlogy', body: 'pretendard', why: '이유' },
    { title: 'suit', body: 'noto-sans-kr', why: '이유' },
    { title: 'gowun-batang', body: 'gowun-dodum', why: '이유' },
    { title: 'noto-serif-kr', body: 'ibm-plex-sans-kr', why: '이유' },
  ],
  image_prompts: [
    { target: 'profile', label: '프로필', prompt: 'A flat mascot character ZUN, 1:1 square, 1080x1080, no text', filename: 'profile-zun.png' },
    {
      target: 'highlight',
      label: '써 보고 정리',
      prompt: 'Icon of a laptop centered within a circle, 9:16 vertical, 1080x1920, no text',
      filename: 'highlight-try.png',
    },
  ],
};
const codes = (d: VisualOutput) => visualRules(4.5).flatMap((r) => r(d)).map((i) => `${i.where}:${i.code}`);

describe('시각 후보 규칙 (FR-BR-2·3·4, 자기 평가 없이 코드만)', () => {
  it('규칙을 지킨 후보는 통과', () => {
    expect(codes(base)).toEqual([]);
  });

  it('명암비: 글자/배경 4.5 미만, 주색 위에 올릴 글자색 없음, 같은 색 팔레트', () => {
    const d = {
      ...base,
      palettes: [pal('흐림', '#1a2a6c', '#ffffff', '#999999'), pal('중간색', '#777777'), base.palettes[0]!, pal('밤하늘 복사', '#1A2A6C')],
    };
    expect(codes(d)).toEqual(['palettes.0:low_contrast', 'palettes.1:low_contrast_on_primary', 'palettes.3:duplicate_candidate']);
  });

  it('폰트: 목록 밖 id, 제목 전용을 본문에, 본문 전용을 제목에', () => {
    const d = {
      ...base,
      font_pairs: [
        { title: 'nanum-gothic', body: 'pretendard', why: '' },
        { title: 'pretendard', body: 'paperlogy', why: '' },
        { title: 'gowun-dodum', body: 'pretendard', why: '' },
        ...base.font_pairs.slice(3),
      ],
    };
    expect(codes(d)).toEqual(['font_pairs.0:font_not_in_list', 'font_pairs.1:font_role', 'font_pairs.2:font_role']);
  });

  it('그림 프롬프트: 영어, "no text", 대상별 비율·크기, 파일 이름', () => {
    const d = {
      ...base,
      image_prompts: [
        { target: 'profile' as const, label: '', prompt: '귀여운 캐릭터, 1:1, 1080x1080, no text', filename: 'profile.png' },
        { target: 'profile' as const, label: '', prompt: 'A cute character, square 1080x1080', filename: 'Profile Zun.PNG' },
        { target: 'highlight' as const, label: '축', prompt: 'An icon centered within a circle, 1:1, 1080x1080, no text', filename: 'h.png' },
      ],
    };
    expect(codes(d)).toEqual([
      'image_prompts.0:prompt_not_english',
      'image_prompts.1:prompt_missing_no_text',
      'image_prompts.1:prompt_missing_size',
      'image_prompts.1:bad_filename',
      'image_prompts.2:prompt_missing_size',
      'image_prompts.2:prompt_missing_size',
    ]);
  });

  it('걸린 후보만 빼고 3개씩 — 명암비 숫자를 함께 저장', () => {
    const d = { ...base, palettes: [pal('흐림', '#1a2a6c', '#ffffff', '#999999'), ...base.palettes.slice(1)] };
    const errors = visualRules(4.5).flatMap((r) => r(d));
    expect(enoughAfterDropping(errors, d)).toBe(true);
    const { picked, dropped } = pickVisual(d, errors);
    expect(picked.palettes.map((p) => p.name)).toEqual(['숲', '벽돌', '잉크']);
    expect(picked.palettes.every((p) => p.contrast.textOnBackground >= 4.5 && p.contrast.bestOnPrimary >= 4.5)).toBe(true);
    expect(picked.fontPairs).toHaveLength(3);
    expect(dropped).toEqual([{ kind: 'palettes', value: '흐림', reasons: [expect.stringContaining('low_contrast')] }]);
  });

  it('빼고 3개가 안 남거나, 쓸 수 있는 프로필 프롬프트가 없으면 다시 쓴다', () => {
    const twoBad = { ...base, palettes: [pal('a', '#777777'), pal('b', '#787878'), ...base.palettes.slice(2)] };
    expect(enoughAfterDropping(visualRules(4.5).flatMap((r) => r(twoBad)), twoBad)).toBe(false);
    const noProfile = { ...base, image_prompts: [{ ...base.image_prompts[0]!, prompt: 'A mascot, 1:1, 1080x1080' }, base.image_prompts[1]!] };
    expect(enoughAfterDropping(visualRules(4.5).flatMap((r) => r(noProfile)), noProfile)).toBe(false);
  });
});

describe('generateVisual 흐름 (가짜 공급자)', () => {
  function setup(steps: FakeStep[]) {
    const db = openDb(':memory:');
    const sid = createSession(db, 1, { S1: { choices: ['대학생'] } });
    const content: ProfileContent = {
      accountLine: '학생에게 써 본 AI 도구 정리',
      accountLineOrigin: 'interview',
      audience: '대학생',
      audienceOrigin: 'interview',
      pillars: [{ id: 'a'.repeat(16), name: '써 보고 정리', description: 'AI 도구를 직접 써 보고 정리', evidence: [], origin: 'interview', expiresAt: null }],
      dropped: [],
      voiceRules: [text('쉽게', 'interview')],
      avoid: [],
      unknown: [],
      presence: { text: '안 한다 — 캐릭터 ZUN 으로 대신한다', source: 'S6', origin: 'interview' },
    };
    const pid = saveProfileVersion(db, 1, content, { reason: 'interview', sessionId: sid, basedOn: null, jobId: null, activate: true });
    const provider = new FakeProvider(steps);
    return { db, pid, provider, ai: new AiService({ db, provider }) };
  }

  it('자기 평가 없이 한 번 호출, 걸린 후보는 빼고 저장 — 프롬프트에 보여 주는 방식·폰트 목록·명암비 기준', async () => {
    const out = { ...base, palettes: [pal('흐림', '#1a2a6c', '#ffffff', '#999999'), ...base.palettes.slice(1)] };
    const { db, pid, ai, provider } = setup([{ structured: out }]);
    const r = await generateVisual(ai, 1);
    expect(provider.calls).toHaveLength(1);
    expect([r.calls, r.rewrites]).toEqual([1, 0]);
    expect(provider.calls[0]!.prompt).toContain('캐릭터 ZUN 으로 대신한다');
    expect(provider.calls[0]!.prompt).toContain('- paperlogy: 페이퍼로지 (제목, display)');
    expect(provider.calls[0]!.prompt).toContain('4.5:1 이상');
    expect(r.candidates.palettes).toHaveLength(3);
    expect(latestKit<VisualCandidates>(db, 1, 'visual')).toMatchObject({ profileId: pid, dropped: [{ kind: 'palettes', value: '흐림' }] });
  });

  it('3개가 안 남으면 문제를 알려 주고 다시 쓴다', async () => {
    const bad = { ...base, palettes: [pal('a', '#777777'), pal('b', '#787878'), ...base.palettes.slice(2)] };
    const { ai, provider } = setup([{ structured: bad }, { structured: base }]);
    const r = await generateVisual(ai, 1);
    expect(r.rewrites).toBe(1);
    expect(provider.calls[1]!.prompt).toContain('low_contrast_on_primary');
    expect(r.candidates.palettes.map((p) => p.name)).toEqual(['밤하늘', '숲', '벽돌']);
  });
});
