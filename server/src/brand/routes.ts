// 브랜딩 키트 API. 생성(글·시각)은 작업 ID 를 먼저 돌려주고 화면이 상태를 묻는다 (취소 가능).
// 고른 것은 바로 저장한다 — 판처럼 이력으로 남는다 (결정 2026-10-14 · 브랜딩 키트 설계)
import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';
import type { AiService } from '../ai/adapter.ts';
import type { JobStore } from '../ai/jobs.ts';
import fs from 'node:fs';
import { env, getSetting } from '../config.ts';
import type { Db } from '../db/index.ts';
import { activeProfile, getProfile, type SavedProfile } from '../identity/store.ts';
import { AssetError, assetPath, MIME, saveAsset, type ImageType } from './assets.ts';
import { FONTS, fontById } from './fonts.ts';
import { contrastRatio, handleProblems, instagramLength, URL_IN_TEXT } from './limits.ts';
import { currentSelection, latestKit, saveSelection, selectionHistory } from './store.ts';
import type { Selection, VisualCandidates, WordsCandidates } from './types.ts';
import { generateVisual } from './visual.ts';
import { CHARACTER_OPTIONS, characterIssues, defaultCharacter, type CharacterSpec } from './character.ts';
import { deleteCharacter, getCharacter, listCharacters, saveCharacter, useAsAccountCharacter } from './characterStore.ts';
import { suggestCharacters } from './characterSuggest.ts';
import { generateWords } from './words.ts';

const BRAND_ID = 1; // 브랜드 여러 개(FR-AC-3)는 F 범위 — 지금은 로컬 브랜드 하나
const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const SelectionPatch = z
  .object({
    handle: z.string().trim().nullable(),
    displayName: z.string().trim().nullable(),
    bio: z.string().trim().nullable(),
    palette: z
      .object({ name: z.string().max(30), colors: z.object({ primary: Hex, secondary: Hex, accent: Hex, background: Hex, text: Hex }), why: z.string().max(200) })
      .nullable(),
    titleFont: z.string().nullable(),
    bodyFont: z.string().nullable(),
    profileImage: z.string().nullable(),
  })
  .partial();
export type SelectionPatch = z.infer<typeof SelectionPatch>;

/**
 * 키트를 만든 뒤 프로필이 「그 생성이 쓰는 부분」까지 바뀌었는가. 판 번호만 비교하면 「보여 주는 방식」만 바꿔도(계정 캐릭터로 쓰기)
 * 아이디 · 바이오까지 다시 만들라고 했다(사용자 시뮬레이션 2026-11-09) — 글 후보는 보여 주는 방식을 쓰지 않는다, 시각 후보(그림 프롬프트)는 쓴다
 */
export function kitStale(db: Db, kitProfileId: number, active: SavedProfile | null, usesPresence: boolean): boolean {
  if (!active || kitProfileId === active.id) return false;
  const old = getProfile(db, kitProfileId);
  if (!old) return true;
  const key = (p: SavedProfile) =>
    JSON.stringify([p.accountLine, p.audience, p.pillars.map((x) => [x.name, x.description]), p.voiceRules.map((x) => x.text), p.avoid.map((x) => x.text), usesPresence ? (p.presence?.text ?? null) : null]);
  return key(old) !== key(active);
}

export function brandLimits(db: Db) {
  const bioMax = getSetting(db, 'brand.bioMax');
  const reserve = getSetting(db, 'brand.bioLinkReserve');
  return {
    handleMax: getSetting(db, 'brand.handleMax'),
    displayNameMax: getSetting(db, 'brand.displayNameMax'),
    bioMax,
    bioLinkReserve: reserve,
    bioUsable: bioMax - reserve,
    minContrast: getSetting(db, 'brand.minContrast'),
    countConfirmed: getSetting(db, 'brand.instagramCountConfirmed'),
  };
}

/**
 * 고른 값(후보든 사용자가 고쳐 쓴 글이든) 검사 — 생성 규칙 중 "고정 규칙"만 다시 건다.
 * 지어낸 숫자·영문 같은 근거 규칙은 걸지 않는다: 사용자가 직접 쓴 글은 그 자체가 허용 출처(4번)다
 */
export function selectionProblems(db: Db, p: SelectionPatch, dataDir: string): string[] {
  const l = brandLimits(db);
  const out: string[] = [];
  if (p.handle) out.push(...handleProblems(p.handle, l.handleMax).map((m) => `아이디: ${m}`));
  if (p.displayName && instagramLength(p.displayName) > l.displayNameMax) out.push(`표시 이름: ${l.displayNameMax}자를 넘습니다(${instagramLength(p.displayName)}자).`);
  if (p.bio) {
    const n = instagramLength(p.bio);
    if (n > l.bioUsable) out.push(`바이오: ${l.bioUsable}자(150 − 링크 자리 ${l.bioLinkReserve})를 넘습니다(${n}자).`);
    if (URL_IN_TEXT.test(p.bio)) out.push('바이오: 주소는 바이오 안이 아니라 링크 칸에 넣습니다.');
  }
  if (p.palette) {
    const c = p.palette.colors;
    const tb = contrastRatio(c.text, c.background);
    if (tb < l.minContrast) out.push(`팔레트: 글자/배경 명암비 ${tb.toFixed(2)}:1 이 ${l.minContrast}:1 미만입니다.`);
  }
  for (const [key, role, label] of [
    ['titleFont', 'title', '제목'],
    ['bodyFont', 'body', '본문'],
  ] as const) {
    const id = p[key];
    if (!id) continue;
    const f = fontById(id);
    if (!f) out.push(`${label} 폰트: 목록에 없는 폰트입니다.`);
    else if (!f.roles.includes(role)) out.push(`${label} 폰트: ${f.name} 은 ${label}용이 아닙니다.`);
  }
  if (p.profileImage && !assetPath(dataDir, p.profileImage)) out.push('프로필 사진: 올린 파일을 찾지 못했습니다. 다시 올려 주세요.');
  return out;
}

export function brandRoutes(ai: AiService, jobs: JobStore, dataDir = env.dataDir) {
  const db = ai.db;
  return new Hono()
    .get('/', (c) => {
      const active = activeProfile(db, BRAND_ID);
      const words = latestKit<WordsCandidates>(db, BRAND_ID, 'words');
      const visual = latestKit<VisualCandidates>(db, BRAND_ID, 'visual');
      return c.json({
        wordsStale: words ? kitStale(db, words.profileId, active, false) : false,
        visualStale: visual ? kitStale(db, visual.profileId, active, true) : false,
        activeProfile: active ? { id: active.id, version: active.version, accountLine: active.accountLine, presence: active.presence?.text ?? null } : null,
        words,
        visual,
        selection: currentSelection(db, BRAND_ID),
        history: selectionHistory(db, BRAND_ID),
        fonts: FONTS,
        limits: brandLimits(db),
      });
    })
    .post('/words', (c) => c.json({ jobId: jobs.start('brand_words', (job) => generateWords(ai, BRAND_ID, job)) }))
    // 개성 캐릭터 프롬프트 기계(2026-11-08). 프롬프트는 화면이 같은 함수로 바로 조립하고, 서버는 고른 값만 저장한다
    .get('/characters', (c) => c.json({ characters: listCharacters(db, BRAND_ID), options: CHARACTER_OPTIONS, fallback: defaultCharacter() }))
    .post('/characters/suggest', (c) => c.json({ jobId: jobs.start('character_suggest', (job) => suggestCharacters(ai, BRAND_ID, job)) }))
    .post(
      '/characters',
      validator('json', (v, c) => {
        const b = z.object({ id: z.number().int().positive().nullable().default(null), spec: z.record(z.string(), z.unknown()) }).safeParse(v);
        return b.success ? b.data : c.json({ error: '캐릭터 모양이 맞지 않아요. 화면을 새로고침한 뒤 다시 저장하세요.' }, 400);
      }),
      (c) => {
        const { id, spec: raw } = c.req.valid('json');
        const spec = { ...defaultCharacter(), ...raw } as CharacterSpec;
        const errors = characterIssues(spec).filter((e) => e.level === 'error');
        if (errors.length) return c.json({ error: errors.map((e) => e.message).join(' ') }, 400);
        if (!spec.name) return c.json({ error: '이름(영문 한 낱말)을 정한 뒤 저장하세요.' }, 400);
        if (id != null && !getCharacter(db, BRAND_ID, id)) return c.json({ error: '저장된 캐릭터를 찾지 못했어요. 새로 저장하세요.' }, 404);
        return c.json({ id: saveCharacter(db, BRAND_ID, spec, id), characters: listCharacters(db, BRAND_ID) });
      },
    )
    .delete('/characters/:id', (c) => c.json({ ok: deleteCharacter(db, BRAND_ID, Number(c.req.param('id'))), characters: listCharacters(db, BRAND_ID) }))
    .post('/characters/:id/use', (c) => {
      const ch = getCharacter(db, BRAND_ID, Number(c.req.param('id')));
      if (!ch) return c.json({ error: '캐릭터를 찾지 못했어요.' }, 404);
      try {
        return c.json(useAsAccountCharacter(db, BRAND_ID, ch));
      } catch (e) {
        return c.json({ error: e instanceof Error ? `${e.message}${'hint' in e ? ` ${String((e as { hint: unknown }).hint)}` : ''}` : String(e) }, 400);
      }
    })
    .post('/visual', (c) => c.json({ jobId: jobs.start('brand_visual', (job) => generateVisual(ai, BRAND_ID, job)) }))
    // 고른 것 저장: 바뀐 칸만 보낸다. 고정 규칙에 걸리면 저장하지 않는다
    .put(
      '/selection',
      validator('json', (value, c) => {
        const body = SelectionPatch.safeParse(value);
        if (!body.success) return c.json({ error: '고른 값의 형식이 맞지 않습니다. 화면을 새로고침한 뒤 다시 골라 주세요.' }, 400);
        const problems = selectionProblems(db, body.data, dataDir);
        if (problems.length) return c.json({ error: problems.join(' ') }, 400);
        return body.data;
      }),
      (c) => {
        const patch = c.req.valid('json') as Partial<Selection>;
        if (Object.keys(patch).length === 0) return c.json({ error: '바뀐 것이 없습니다.' }, 400);
        const id = saveSelection(db, BRAND_ID, activeProfile(db, BRAND_ID)?.id ?? null, patch);
        return c.json({ id, selection: currentSelection(db, BRAND_ID) });
      },
    )
    // 그림 올리기: 본문은 파일 그대로(바이트). 저장한 이름을 돌려주고, 적용은 /selection 으로 따로 한다
    .post('/assets', async (c) => {
      try {
        const bytes = new Uint8Array(await c.req.arrayBuffer());
        return c.json({ name: saveAsset(dataDir, bytes, getSetting(db, 'brand.maxUploadBytes')) });
      } catch (err) {
        if (err instanceof AssetError) return c.json({ error: `${err.message} ${err.hint}` }, 400);
        throw err;
      }
    })
    .get('/assets/:name', (c) => {
      const name = c.req.param('name');
      const p = assetPath(dataDir, name);
      if (!p) return c.json({ error: '그림을 찾지 못했습니다.' }, 404);
      const type = name.split('.').pop() as ImageType;
      return c.body(fs.readFileSync(p), 200, { 'content-type': MIME[type], 'cache-control': 'no-store' });
    });
}
