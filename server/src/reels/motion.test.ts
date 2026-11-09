// 릴스 모션그래픽(결정 2026-11-08): 프레임 계산 · 규칙 · AI 제안 경로(가짜 공급자)
import { describe, expect, it } from 'vitest';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider } from '../ai/testing/fake-provider.ts';
import { saveSelection } from '../brand/store.ts';
import { getSetting } from '../config.ts';
import { openDb } from '../db/index.ts';
import { defaultTextStyle, estimateTextBox, STYLE_PRESETS, type Palette, type ReelDoc, type TextClip, type TextMotion, type TextStyle } from './model.ts';
import { holdFrames, motionAt, motionExtent, noMotion, sceneMotionAt, sceneSpan, segmentsFor, splitVisible } from './motion.ts';
import { checkMotion } from './motionCheck.ts';
import { applyMotion, motionRules, proposeMotion, type MotionPlan } from './motionPlan.ts';
import { createReel, saveReel } from './store.ts';

const palette: Palette = { primary: '#10b981', secondary: '#1e293b', accent: '#fde047', background: '#0b1220', text: '#e2e8f0' };
const guide = { x: 0, y: 240, w: 1080, h: 1440 };
const L = getSetting(null, 'reels.motion');
const mo = (p: Partial<TextMotion>): TextMotion => ({ ...noMotion(), ...p });
const clip = (p: Omit<Partial<TextClip>, 'style'> & { style?: Partial<TextStyle> }): TextClip => ({ id: 't1', start: 0, duration: 60, text: '첫 1초에 결과부터', subtitle: false, ...p, style: { ...defaultTextStyle(), ...p.style } });
const docOf = (texts: TextClip[], extra: Partial<ReelDoc> = {}): ReelDoc => ({
  version: 1,
  name: '시험',
  bg: { kind: 'solid', color: '#0b1220' },
  scenes: [
    { id: 's1', name: '훅', start: 0, duration: 60, media: null, bg: null },
    { id: 's2', name: '본론', start: 60, duration: 60, media: null, bg: null },
  ],
  texts,
  overlays: [],
  audio: [],
  assets: [],
  memo: '',
  original: {},
  ...extra,
});
const codes = (d: ReelDoc) => checkMotion(d, palette, guide, L).map((i) => `${i.level}:${i.code}`);

describe('모션 프레임 계산', () => {
  it('모션이 없으면 늘 그대로', () => {
    expect(motionAt(0, 60, undefined)).toMatchObject({ opacity: 1, tx: 0, ty: 0, scale: 1, chars: 1 });
  });
  it('rise: 0프레임에 투명 · 60px 아래, 등장이 끝나면 제자리', () => {
    const m = mo({ enter: 'rise', enterFrames: 10 });
    expect(motionAt(0, 60, m)).toMatchObject({ opacity: 0, ty: 60 });
    expect(motionAt(10, 60, m)).toMatchObject({ opacity: 1, ty: 0 });
  });
  it('fade 퇴장: 마지막 프레임 가까이 거의 사라짐 · 퇴장 전에는 다 보임', () => {
    const m = mo({ exit: 'fade', exitFrames: 6 });
    expect(motionAt(53, 60, m).opacity).toBe(1);
    expect(motionAt(59, 60, m).opacity).toBeLessThan(0.5);
  });
  it('pop 은 끝에서 크기가 살짝 넘친다(가이드 검사가 그 넘침을 본다)', () => {
    const m = mo({ enter: 'pop', enterFrames: 12 });
    const peak = Math.max(...Array.from({ length: 13 }, (_, f) => motionAt(f, 60, m).scale));
    expect(peak).toBeGreaterThan(1);
    expect(motionAt(12, 60, m).scale).toBeCloseTo(1);
  });
  it('다 보이는 시간 = 길이 − 등장 − 퇴장', () => {
    expect(holdFrames({ duration: 40, motion: mo({ enter: 'fade', enterFrames: 8, exit: 'fade', exitFrames: 6 }) })).toBe(26);
  });
  it('움직이는 범위: rise 는 아래로 넓어지고 slide-left 는 오른쪽으로', () => {
    const b = { x: 100, y: 1000, w: 400, h: 100 };
    const rise = motionExtent(b, { duration: 60, motion: mo({ enter: 'rise', enterFrames: 10 }) });
    expect(rise.y + rise.h).toBeGreaterThan(b.y + b.h + 30);
    const slide = motionExtent(b, { duration: 60, motion: mo({ enter: 'slide-left', enterFrames: 10 }) });
    expect(slide.x + slide.w).toBeGreaterThan(b.x + b.w + 60);
  });
  it('강조 낱말로 나누기 · 한 글자씩(한글 · 이모지 하나가 한 글자, 숨긴 쪽도 자리를 지킨다)', () => {
    const segs = segmentsFor('3분이면 끝나요 🎉', [{ word: '3분', style: 'highlight' }, { word: '없는말', style: 'color' }]);
    expect(segs).toEqual([{ text: '3분', emph: 0 }, { text: '이면 끝나요 🎉', emph: null }]);
    const v = splitVisible(segs, 0.5);
    expect(v.filter((s) => !s.hidden).map((s) => s.text).join('')).toBe('3분이면 ');
    expect(v.map((s) => s.text).join('')).toBe('3분이면 끝나요 🎉');
  });
  it('장면 전환: 앞 장면은 겹치는 만큼 더 그리고, 들어오는 장면은 처음에 투명', () => {
    const scenes = docOf([]).scenes;
    scenes[1] = { ...scenes[1]!, transition: 'fade', transitionFrames: 10 };
    expect(sceneSpan(scenes, scenes[0]!)).toBe(70);
    expect(sceneSpan(scenes, scenes[1]!)).toBe(60);
    expect(sceneMotionAt(0, scenes[1]!).opacity).toBe(0);
    expect(sceneMotionAt(10, scenes[1]!).opacity).toBe(1);
  });
});

describe('모션 규칙', () => {
  it('보기 좋은 모션은 통과', () => {
    expect(codes(docOf([clip({ motion: mo({ enter: 'pop', enterFrames: 12, exit: 'fade', exitFrames: 6, emphasis: [{ word: '결과', style: 'highlight' }] }) })]))).toEqual([]);
  });
  it('다 보이는 시간이 모자라면 · 자막 등장이 길면 · 3프레임 밑 움직임은 재작성', () => {
    expect(codes(docOf([clip({ duration: 20, motion: mo({ enter: 'fade', enterFrames: 10, exit: 'fade', exitFrames: 6 }) })]))).toContain('error:hold_too_short');
    expect(codes(docOf([clip({ subtitle: true, motion: mo({ enter: 'rise', enterFrames: 14 }) })]))).toContain('error:enter_too_long');
    expect(codes(docOf([clip({ motion: mo({ enter: 'fade', enterFrames: 1 }) })]))).toContain('error:enter_too_short');
  });
  it('가이드 아래에 붙은 글자가 rise 로 들어오면 격자 밖에서 시작 — 잡는다. fade 는 통과', () => {
    const style = { y: 0 };
    const base = clip({ style });
    const b = estimateTextBox(base);
    const y = guide.y + guide.h - b.h / 2 - 10; // 아래 여유 10px
    expect(codes(docOf([clip({ style: { y }, motion: mo({ enter: 'rise', enterFrames: 10 }) })]))).toContain('error:motion_outside_guide');
    expect(codes(docOf([clip({ style: { y }, motion: mo({ enter: 'fade', enterFrames: 10 }) })]))).not.toContain('error:motion_outside_guide');
  });
  it('가만히 있을 때 이미 가이드 밖이면 모션 탓으로 잡지 않는다(편집 화면이 따로 경고)', () => {
    expect(codes(docOf([clip({ style: { y: 100 }, motion: mo({ enter: 'rise', enterFrames: 10 }) })]))).not.toContain('error:motion_outside_guide');
  });
  it('강조 낱말은 글자 안에 있어야 · 칠 위 글자 명암비 4.5:1', () => {
    expect(codes(docOf([clip({ motion: mo({ emphasis: [{ word: '5배', style: 'highlight' }] }) })]))).toContain('error:emphasis_not_in_text');
    // 사람이 고른 흰 글자 + 노란 칠 → 명암비 부족
    expect(codes(docOf([clip({ style: { color: '#ffffff' }, motion: mo({ emphasis: [{ word: '결과', style: 'highlight' }], accentColor: 'accent' }) })]))).toContain('error:emphasis_contrast');
  });
  it('영상 위 글자의 색만 바꾼 강조는 잴 수 없어 재작성(highlight 로)', () => {
    const d = docOf([clip({ style: STYLE_PRESETS.plain.style, motion: mo({ emphasis: [{ word: '결과', style: 'color' }] }) })]);
    d.scenes[0] = { ...d.scenes[0]!, media: { src: '/x.mp4', kind: 'video', trim: 0 } };
    expect(codes(d)).toContain('error:emphasis_unknown_bg');
  });
  it('박스 있는 글자 뒤 띠는 안 보여서 재작성', () => {
    expect(codes(docOf([clip({ style: { preset: 'softbox' }, motion: mo({ accent: 'sweep' }) })]))).toContain('error:sweep_on_box');
  });
  it('장면 전환이 장면 길이의 절반 · 설정값을 넘으면 재작성', () => {
    const d = docOf([]);
    d.scenes[1] = { ...d.scenes[1]!, transition: 'fade', transitionFrames: 40 };
    expect(codes(d)).toContain('error:transition_too_long');
  });
  it('자막마다 등장이 다르면 경고만(취향)', () => {
    const d = docOf([clip({ id: 'a', subtitle: true, motion: mo({ enter: 'fade', enterFrames: 6 }) }), clip({ id: 'b', start: 60, subtitle: true, motion: mo({ enter: 'rise', enterFrames: 6 }) })]);
    expect(codes(d)).toEqual(['warn:subtitle_mixed']);
  });
});

const planOf = (d: ReelDoc, over: Partial<MotionPlan['texts'][number]> = {}): MotionPlan => ({
  texts: d.texts.map((t) => ({ id: t.id, enter: 'fade', enter_frames: 6, exit: 'none', exit_frames: 0, emphasis: [], accent: 'none', accent_color: 'accent', loop: 'none', ...over })),
  scenes: d.scenes.map((s) => ({ id: s.id, transition: 'cut', transition_frames: 0, camera: 'zoom-in' })),
  progress: 'none',
  note: '차분하게',
});

describe('모션 제안', () => {
  it('제안 입히기: 글자 · 위치 · 시간은 그대로, 모션만', () => {
    const d = docOf([clip({})]);
    const out = applyMotion(d, planOf(d, { enter: 'pop', enter_frames: 12 }));
    expect(out.texts[0]!.text).toBe(d.texts[0]!.text);
    expect(out.texts[0]!.style).toEqual(d.texts[0]!.style);
    expect(out.texts[0]!.motion).toMatchObject({ enter: 'pop', enterFrames: 12, accentColor: 'accent' });
    expect(out.scenes[0]!.camera).toBe('zoom-in');
  });
  it('id 가 빠지거나 없는 id 면 재작성', () => {
    const d = docOf([clip({})]);
    const rules = motionRules({ doc: d, palette, guide, limits: L });
    const p = planOf(d);
    const bad = { ...p, texts: [{ ...p.texts[0]!, id: 'zzz' }] };
    const found = rules.flatMap((r) => r(bad)).map((i) => i.code);
    expect(found).toEqual(expect.arrayContaining(['unknown_id', 'missing_id']));
    expect(rules.flatMap((r) => r(p))).toEqual([]);
  });
  it('가짜 AI: 규칙 위반 → 재작성 → 통과한 제안만 돌려주고 편집 내용은 바꾸지 않는다', async () => {
    const db = openDb(':memory:');
    saveSelection(db, 1, null, { palette: { name: '시험', colors: palette, why: '' }, titleFont: 'suit', bodyFont: 'pretendard', handle: 'test.id' });
    const reel = createReel(db, 1, '시험');
    const d = docOf([clip({})]);
    saveReel(db, 1, reel.id, d);
    const good = planOf(d);
    const bad = planOf(d, { enter: 'fade', enter_frames: 1 });
    const provider = new FakeProvider([{ structured: bad }, { structured: good }]);
    const ai = new AiService({ db, provider });
    const r = await proposeMotion(ai, 1, reel.id);
    expect(r.rewrites).toBe(1);
    expect(r.plan.texts[0]!.enter_frames).toBe(6);
    // 재작성 요청에 이유(3프레임 밑)가 들어간다
    expect(provider.calls[1]!.prompt).toContain('enter_too_short');
    // 프롬프트에 가이드까지 여유가 보인다
    expect(provider.calls[0]!.prompt).toContain('가이드까지 여유');
    const saved = db.prepare('SELECT doc_json FROM reels WHERE id = ?').get(reel.id) as { doc_json: string };
    expect((JSON.parse(saved.doc_json) as ReelDoc).texts[0]!.motion).toBeUndefined();
  });
});

describe('모션 한 줄 설명을 화면 이름으로', () => {
  it('프리셋 이름만 바꾸고 다른 영어 · 한국어는 그대로', async () => {
    const { humanizeMotionNote } = await import('./motion.ts');
    expect(humanizeMotionNote('첫 제목은 pop과 16클릭 강조, 자막은 짧은 fade, 장면은 slide-up으로')).toBe('첫 제목은 「톡 튀어나오기」와 16클릭 강조, 자막은 짧은 「서서히」, 장면은 「아래에서 밀어 올리기 전환」으로');
    expect(humanizeMotionNote('V60 드립과 popular 원두')).toBe('V60 드립과 popular 원두');
  });
});

describe('바꾼 이름 뒤 조사', () => {
  it('받침에 맞춰 과/와 · 을/를 · 으로/로', async () => {
    const { humanizeMotionNote } = await import('./motion.ts');
    expect(humanizeMotionNote('fade로 넘기고 cut을 쓰고 bar를 넣음')).toBe('「서서히」로 넘기고 「컷 전환」을 쓰고 「아래 막대」를 넣음');
  });
});
