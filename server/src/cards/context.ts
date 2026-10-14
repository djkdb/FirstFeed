// 카드 생성 한 번에 필요한 것을 한 곳에서 모은다: 소재·프로필·고정 템플릿 판(모양·글자 수)·근거 허용 출처
import { commonEnglishTerms, env, getSetting } from '../config.ts';
import type { Db } from '../db/index.ts';
import { currentSelection } from '../brand/store.ts';
import { FlowError } from '../identity/flow.ts';
import { formatProfileForPrompt, profileForGeneration, profileGroundingTexts, type ProfileInput } from '../identity/for-generation.ts';
import { userAuthoredTexts } from '../identity/model.ts';
import { activeProfile } from '../identity/store.ts';
import type { GroundingSources } from '../rules/grounding.ts';
import type { Budget } from '../templates/budget.ts';
import { draftById } from '../templates/index.ts';
import { resolveLook } from '../templates/look.ts';
import { fixedTemplate } from '../templates/store.ts';
import type { BrandLook, Draft } from '../templates/types.ts';
import { getSource, type Source } from './store.ts';

export interface CardContext {
  brandId: number;
  source: Source;
  profile: ProfileInput;
  template: { id: number; draft: Draft; look: BrandLook; budget: Budget };
  /** 허용 출처 4가지 중 1·2·4 (3 구조 숫자는 단계마다 정한다) */
  grounding: Omit<GroundingSources, 'structural'>;
  commonTerms: string[];
  bodyRange: [number, number];
}

export function cardContext(db: Db, brandId: number, sourceId: number, dataDir = env.dataDir): CardContext {
  const source = getSource(db, sourceId);
  if (!source || source.brandId !== brandId) throw new FlowError('소재를 찾지 못했습니다.', '소재를 다시 붙여 넣으세요.');
  const profile = profileForGeneration(db, brandId);
  const fixed = fixedTemplate(db, brandId);
  if (!fixed) throw new FlowError('고정한 템플릿이 없습니다.', '「템플릿」 탭에서 시안 하나를 고정한 뒤 다시 시도하세요.');
  const draft = draftById(fixed.draftId);
  if (!draft) throw new FlowError(`고정한 템플릿의 시안(${fixed.draftId})을 찾지 못했습니다.`, '「템플릿」 탭에서 다시 고정하세요.');
  const sel = currentSelection(db, brandId);
  const active = activeProfile(db, brandId);
  return {
    brandId,
    source,
    profile,
    template: { id: fixed.id, draft, look: resolveLook(fixed.look, dataDir), budget: fixed.budget },
    grounding: {
      source: [source.body],
      brand: [...profileGroundingTexts(profile), ...[sel.handle, sel.displayName].filter((x): x is string => !!x)],
      userInput: [...(source.memo ? [source.memo] : []), ...(active ? userAuthoredTexts(active) : [])],
    },
    commonTerms: commonEnglishTerms(db),
    bodyRange: [getSetting(db, 'cards.bodyMin'), getSetting(db, 'cards.bodyMax')],
  };
}

export const profileBlock = (c: CardContext) => formatProfileForPrompt(c.profile);

/** 한 줄 글자 수로 미리 거르기 — 렌더링 전에 싸게. \n 으로 나눈 줄마다 (글자 수 ÷ 한 줄 글자 수) 를 올림해서 더한다 */
export function estimatedLines(text: string, charsPerLine: number): number {
  return text
    .replace(/\*\*/g, '')
    .split('\n')
    .reduce((n, line) => n + Math.max(1, Math.ceil([...line.replace(/\s/g, '')].length / Math.max(1, charsPerLine))), 0);
}
