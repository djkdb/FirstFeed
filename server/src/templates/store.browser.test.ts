// 템플릿 고정·판 (FR-TP-3) + 칸별 한 줄 글자 수
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { env } from '../config.ts';
import { openDb } from '../db/index.ts';
import { closeBrowser } from '../render/browser.ts';
import { measureBudget } from './budget.ts';
import { DRAFTS } from './index.ts';
import { fixedTemplate, fixTemplate, getTemplateVersion, listTemplateVersions } from './store.ts';
import type { BrandLook } from './types.ts';

const brand = (set: string, id: string): BrandLook => JSON.parse(fs.readFileSync(path.join(env.repoRoot, `tests/fixtures/${set}/brands/${id}.json`), 'utf8')).look;
afterAll(() => closeBrowser());

describe('템플릿 고정과 판', () => {
  it('고를 때마다 새 판, 고정 판은 최신. 옛 판은 그대로 남아 옛 콘텐츠를 옛 틀로 다시 그릴 수 있다', () => {
    const db = openDb(':memory:');
    const look = brand('real', 'me');
    const v1 = fixTemplate(db, 1, 'A', look, { cover: { headline: { charsPerLine: 9, maxLines: 2, maxChars: null } } }, 'playwright-chromium 156', null);
    expect(fixedTemplate(db, 1)?.id).toBe(v1);
    const changed = { ...look, palette: { ...look.palette, primary: '#000000' } };
    const v2 = fixTemplate(db, 1, 'B', changed, {}, 'playwright-chromium 156', null);
    expect(fixedTemplate(db, 1)).toMatchObject({ id: v2, version: 2, draftId: 'B' });
    expect(getTemplateVersion(db, v1)).toMatchObject({ version: 1, draftId: 'A', look: { palette: { primary: look.palette.primary } } });
    expect(listTemplateVersions(db, 1).map((v) => v.version)).toEqual([2, 1]);
  });
});

describe('칸별 한 줄 글자 수 — 그 브랜드의 실제 폰트로 잰다', () => {
  // 처음엔 "폰트가 다르면 한 줄 글자 수가 다르다"고 봤는데 me(페이퍼로지)·doyun(고운바탕) 표지 제목이 둘 다 10자였다 —
  // 한글은 대부분 폰트에서 한 글자 폭이 1em 에 가깝고 줄은 띄어쓰기에서 바뀌어서. 그래도 폰트마다 재는 것은 유지한다(영문·숫자 폭은 다르다)
  it('칸마다 최대 줄 수와 한 줄 글자 수를 잰다', async () => {
    const me = await measureBudget(null, DRAFTS[0]!, brand('real', 'me'));
    const doyun = await measureBudget(null, DRAFTS[0]!, brand('generated', 'doyun'));
    expect(me.browser.kind).toBe('playwright-chromium');
    expect(me.budget.cover?.headline).toMatchObject({ maxLines: 2 });
    expect(me.budget.cover!.headline!.charsPerLine).toBeGreaterThan(5);
    expect(me.budget.body?.text?.charsPerLine).toBeGreaterThan(me.budget.cover!.headline!.charsPerLine);
    expect(doyun.budget.reel_cover?.headline?.maxLines).toBe(3);
    expect(me.budget.body?.text?.maxChars).toBeGreaterThan(100);
    console.log('[한 줄 글자 수] me', JSON.stringify(me.budget), '\n doyun', JSON.stringify(doyun.budget));
  }, 60_000);
});
