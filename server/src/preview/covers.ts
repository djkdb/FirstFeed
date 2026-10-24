// 계획 칸을 실제 표지로 그린다 (FR-BR-6 확장 · devlog 2026-10-22-02). 카드 표지와 같은 렌더링 경로(renderFrame) ·
// 같은 넘침 규칙이고 AI 는 부르지 않는다. 넘치면 그 칸은 PNG 를 만들지 않고 이유를 돌려준다(화면은 자리표시로 남긴다).
// 결과는 [제목 · 축 이름 · 고정 템플릿 판] 이 같으면 다시 쓴다 — 칸 하나를 고치면 그 칸만 다시 그려진다.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { activeProfile } from '../identity/store.ts';
import { draftById } from '../templates/index.ts';
import { resolveLook } from '../templates/look.ts';
import { renderFrame } from '../templates/render-frame.ts';
import { fixedTemplate } from '../templates/store.ts';
import { latestPlan } from './plan.ts';
import { getSetting } from '../config.ts';
import { pillarIndexOf } from '../templates/variant.ts';

export type PlanCover = { ok: true; file: string; cached: boolean } | { ok: false; reason: string; cached: boolean };

export const previewDir = (dataDir: string) => path.join(dataDir, 'previews');
/** 화면이 파일을 달라고 할 때 이 모양만 내준다 */
export const PLAN_FILE = /^plan-[0-9a-f]{16}\.png$/;

// 브라우저 한 개를 돌려 쓰므로 한 번에 하나씩 그린다(화면이 9칸을 한꺼번에 물어도)
let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
};

export async function planCover(db: DatabaseSync, dataDir: string, brandId: number, idx: number): Promise<PlanCover> {
  const plan = latestPlan(db, brandId);
  const slot = plan?.slots[idx];
  if (!slot) return { ok: false, reason: `${idx + 1}번 계획 칸이 없어요.`, cached: false };
  const fixed = fixedTemplate(db, brandId);
  const draft = fixed ? draftById(fixed.draftId) : undefined;
  if (!fixed || !draft) return { ok: false, reason: '고정한 템플릿이 없어 표지로 그릴 수 없어요.', cached: false };
  const pillars = activeProfile(db, brandId)?.pillars ?? [];
  const chip = pillars.find((p) => p.id === slot.pillarId)?.name ?? null;
  // 축 색 변형(2026-10-25): 실제 카드 표지와 같은 축 번호 · 같은 함수. 켜고 끔 · 번호가 바뀌면 다시 그린다
  const pillarIndex = pillarIndexOf(pillars, slot.pillarId);
  const variant = getSetting(db, 'render.pillarCoverVariant') ? pillarIndex : null;
  const key = crypto.createHash('sha256').update(JSON.stringify([slot.title, chip, fixed.id, variant])).digest('hex').slice(0, 16);
  const dir = previewDir(dataDir);
  const png = path.join(dir, `plan-${key}.png`);
  const failed = path.join(dir, `plan-${key}.json`);
  if (fs.existsSync(png)) return { ok: true, file: path.basename(png), cached: true };
  if (fs.existsSync(failed)) return { ok: false, reason: (JSON.parse(fs.readFileSync(failed, 'utf8')) as { reason: string }).reason, cached: true };

  return serial(async () => {
    const fr = await renderFrame(db, draft, resolveLook(fixed.look, dataDir), { kind: 'cover', headline: slot.title, sub: null, chip }, { pillarIndex });
    fs.mkdirSync(dir, { recursive: true });
    if (fr.ok && fr.png) {
      fs.writeFileSync(png, fr.png);
      return { ok: true as const, file: path.basename(png), cached: false };
    }
    const reason = fr.shorten[0]?.message ?? fr.problems[0]?.message ?? '표지 틀에 들어가지 않아요.';
    fs.writeFileSync(failed, JSON.stringify({ reason }));
    return { ok: false as const, reason, cached: false };
  });
}
