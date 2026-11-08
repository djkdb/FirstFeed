// 개성 캐릭터 프롬프트 기계(2026-11-08): 조립 · 반영 확인 · 규칙 · 추천(가짜 AI) · 저장 · 계정 캐릭터로 쓰기
import { describe, expect, it } from 'vitest';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider } from '../ai/testing/fake-provider.ts';
import { createApp } from '../app.ts';
import { openDb } from '../db/index.ts';
import { saveProfileVersion } from '../identity/store.ts';
import type { ProfileContent } from '../identity/model.ts';
import { CHARACTER_OPTIONS, characterIssues, characterPrompts, defaultCharacter, type CharacterSpec } from './character.ts';
import { presenceFor } from './characterStore.ts';
import { saveSelection } from './store.ts';
import { cardPeopleRule, imagePromptIssues } from './visual.ts';

const palette = { primary: '#10b981', secondary: '#1e293b', accent: '#fde047', background: '#0b1220', text: '#e2e8f0' };
const H = { host: 'localhost:4317', 'content-type': 'application/json' };

describe('캐릭터 프롬프트 조립', () => {
  it('고른 값이 모두 프롬프트에 들어간다(반영 확인) · 이름은 프롬프트에 넣지 않는다', () => {
    const s: CharacterSpec = { ...defaultCharacter(), name: 'Coco', accessories: ['laptop', 'headphones'], extra: 'tiny star on the hoodie' };
    const p = characterPrompts(s, palette);
    for (const part of p.parts.filter((x) => x.phrase)) expect(p.main).toContain(part.phrase);
    expect(p.main).toContain('#10b981');
    expect(p.main).not.toContain('Coco');
    expect(p.sheet).toContain(p.dna);
    expect(p.dna).not.toMatch(/waving|plain solid/); // 고정 설명에는 포즈 · 배경이 없다
  });
  it('어떤 조합이든 만든 프롬프트는 카드 그림 규칙(실사 사람 · 사진 표현 · 실존 인물 · no text)을 통과한다', () => {
    const C = CHARACTER_OPTIONS;
    for (const kind of C.kind) {
      for (const species of C.species[kind.id as CharacterSpec['kind']]) {
        for (const style of C.style) {
          const s: CharacterSpec = { ...defaultCharacter(), kind: kind.id as CharacterSpec['kind'], species: species.id, style: style.id, hair: kind.id === 'human' ? 'curly' : 'none' };
          const p = characterPrompts(s, palette);
          for (const text of [p.main, p.sheet]) {
            const codes = imagePromptIssues('x', { prompt: text, filename: 'character.png' }, [], 'illustrated')
              .map((i) => i.code)
              // 머리 모양 같은 생김새는 사용자가 고른 것이라 이 기계에서는 허용(카드 그림의 「지어낸 외모」 규칙과 다른 경우)
              .filter((c) => c !== 'prompt_age_appearance');
            expect(codes, `${kind.id}/${species.id}/${style.id}`).toEqual([]);
          }
        }
      }
    }
  });
});

describe('캐릭터 규칙', () => {
  const codes = (p: Partial<CharacterSpec>) => characterIssues({ ...defaultCharacter(), name: 'Coco', ...p }).map((i) => `${i.level}:${i.code}`);
  it('사진 표현 · 작가 화풍 · 실존 인물 이름 · 민감한 말 · 한글은 덧붙인 말에 쓸 수 없다', () => {
    expect(codes({ extra: 'photorealistic fur' })).toContain('error:extra_photo');
    expect(codes({ extra: 'in the style of a famous painter' })).toContain('error:extra_named');
    expect(codes({ extra: 'looks like Steve Jobs' })).toContain('error:extra_named');
    expect(codes({ extra: 'sexy pose' })).toContain('error:extra_sensitive');
    expect(codes({ extra: '별무늬 후드' })).toContain('error:extra_not_english');
    expect(codes({ extra: 'tiny star on the hoodie' })).toEqual([]);
  });
  it('이름은 영문 한 낱말 · 소품 · 성격은 2개까지', () => {
    expect(codes({ name: '코코' })).toContain('error:bad_name');
    expect(codes({ name: 'Coco Bean' })).toContain('error:bad_name');
    expect(codes({ accessories: ['laptop', 'cap', 'book'] })).toContain('error:too_many_accessories');
    expect(codes({ name: '' })).toEqual(['warn:no_name']);
  });
});

const sugg = (over: Record<string, unknown> = {}) => ({
  name: 'Coco',
  concept: '노트북을 든 호기심 많은 고양이',
  why: '만든 것을 보여 주는 축에 맞춰',
  kind: 'animal',
  species: 'cat',
  style: 'flat',
  line: 'clean',
  shading: 'cel',
  eyes: 'round',
  hair: 'none',
  marking: 'blush',
  outfit: 'hoodie',
  accessories: ['laptop'],
  personality: ['curious'],
  expression: 'smile',
  pose: 'wave',
  body_color: 'primary',
  accent_color: 'accent',
  ...over,
});

const profile: ProfileContent = {
  accountLine: 'AI 도구를 직접 써 보고 정리하는 계정',
  accountLineOrigin: 'interview',
  audience: 'AI 를 막 시작한 학생',
  audienceOrigin: 'interview',
  pillars: [{ id: 'p1', name: '써 본 도구', description: '직접 써 본 AI 도구', evidence: [], origin: 'interview', expiresAt: null }],
  dropped: [],
  voiceRules: [{ text: '쉽게 말한다', origin: 'interview', expiresAt: null }],
  avoid: [],
  unknown: [],
  presence: { text: '안 한다', source: 'S6', origin: 'interview' },
};

describe('캐릭터 추천 · 저장 · 계정 캐릭터로 쓰기(API)', () => {
  it('추천: 표 밖 · 종류에 안 맞는 값 · 겹치는 후보는 재작성, 통과한 3안만', async () => {
    const db = openDb(':memory:');
    saveSelection(db, 1, null, { palette: { name: '시험', colors: palette, why: '' }, titleFont: 'suit', bodyFont: 'pretendard', handle: 'test.id' });
    saveProfileVersion(db, 1, profile, { reason: 'interview', sessionId: null, basedOn: null, jobId: null, activate: true });
    const bad = { candidates: [sugg(), sugg({ name: 'Mochi' }), sugg({ name: 'Bolt', kind: 'object', species: 'cat' })] };
    const good = { candidates: [sugg(), sugg({ name: 'Mochi', species: 'rabbit', style: 'chibi' }), sugg({ name: 'Bolt', kind: 'object', species: 'robot', style: 'pixel' })] };
    const provider = new FakeProvider([{ structured: bad }, { structured: good }]);
    const app = createApp({ db, ai: new AiService({ db, provider }) });
    const { jobId } = (await (await app.request('/api/brand/characters/suggest', { method: 'POST', headers: H })).json()) as { jobId: string };
    let job: { phase: string; result: { candidates: unknown[]; rewrites: number } | null } = { phase: 'running', result: null };
    for (let i = 0; i < 50 && job.phase === 'running'; i++) {
      await new Promise((r) => setTimeout(r, 20));
      job = (await (await app.request(`/api/ai/jobs/${jobId}`, { headers: H })).json()) as typeof job;
    }
    expect(job.phase).toBe('done');
    expect(job.result!.candidates).toHaveLength(3);
    expect(job.result!.rewrites).toBe(1);
    expect(provider.calls[1]!.prompt).toMatch(/species_kind|same_candidate/);
    expect(provider.calls[0]!.prompt).toContain('cat(고양이)'); // 선택지 표가 프롬프트에
  });
  it('저장 → 계정 캐릭터로 쓰기: 프로필 새 판의 「보여 주는 방식」이 캐릭터가 되고 카드 그림 규칙이 캐릭터로 바뀐다', async () => {
    const db = openDb(':memory:');
    saveProfileVersion(db, 1, profile, { reason: 'interview', sessionId: null, basedOn: null, jobId: null, activate: true });
    const app = createApp({ db, ai: new AiService({ db, provider: new FakeProvider([]) }) });
    const noName = await app.request('/api/brand/characters', { method: 'POST', headers: H, body: JSON.stringify({ spec: { ...defaultCharacter(), name: '' } }) });
    expect(noName.status).toBe(400);
    const badExtra = await app.request('/api/brand/characters', { method: 'POST', headers: H, body: JSON.stringify({ spec: { ...defaultCharacter(), name: 'Coco', extra: 'cinematic photo' } }) });
    expect(badExtra.status).toBe(400);
    const r = (await (await app.request('/api/brand/characters', { method: 'POST', headers: H, body: JSON.stringify({ spec: { ...defaultCharacter(), name: 'Coco' } }) })).json()) as { id: number };
    const used = (await (await app.request(`/api/brand/characters/${r.id}/use`, { method: 'POST', headers: H })).json()) as { profileId: number };
    expect(used.profileId).toBeGreaterThan(0);
    const brand = (await (await app.request('/api/brand', { headers: H })).json()) as { activeProfile: { presence: string } };
    expect(brand.activeProfile.presence).toBe(presenceFor('Coco'));
    expect(cardPeopleRule(brand.activeProfile.presence)).toBe('character');
  });
});
