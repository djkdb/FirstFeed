// 정체성 → 브랜드 프로필 초안 (FR-ID-4).
// 인용은 "그 인용이 가리키는 출처의 답" 안에서만 대조한다 — 다른 답의 문장을 갖다 붙이거나, AI 가 쓴 질문·예시 답을 인용하면 실패.
// 재작성 끝까지 실패하면 한 단계 더(결정): 근거 없는 축만 빼고도 3개 이상이면 저장하고 뺀 축은 「근거 부족」으로 보인다.
import { z } from 'zod';
import { getSetting } from '../config.ts';
import type { AiService, JobContext } from '../ai/adapter.ts';
import { generateChecked } from '../ai/loop.ts';
import { loadPrompt } from '../ai/prompts.ts';
import { findUngrounded, normalizeForQuote, quoteInSources } from '../rules/grounding.ts';
import { similarity } from '../rules/similarity.ts';
import type { Issue, Rule } from '../rules/types.ts';
import { formatSourcesForPrompt, type EvidenceSource } from './sources.ts';

const Evidence = z.object({ quote: z.string().min(1).max(300), source: z.string().regex(/^[SA]\d{1,2}$/) });
const Pillar = z.object({
  name: z.string().min(1).max(20),
  description: z.string().min(1).max(100),
  evidence: z.array(Evidence).min(1).max(3),
});
export const ProfileSchema = z.object({
  account_line: z.string().min(1).max(30),
  audience: z.string().min(1).max(100),
  // 3개 미만도 받는다 — 근거가 없는데 개수를 채우라고 하면 지어낸다. 3개 미만은 흐름에서 처리(인터뷰로 돌아가기)
  pillars: z.array(Pillar).min(1).max(5),
  voice_rules: z.array(z.string().min(1).max(80)).length(3),
  avoid: z.array(z.string().min(1).max(80)).max(6),
  unknown: z.array(z.string().min(1).max(100)).max(6),
});
export type ProfileDraft = z.infer<typeof ProfileSchema>;

/** 저장되는 축: 코드가 확인한 인용만, 출처 이름과 함께 */
export interface VerifiedEvidence {
  quote: string;
  source: string;
  sourceLabel: string;
  countsAsUserInput: boolean;
}
export interface VerifiedPillar {
  name: string;
  description: string;
  evidence: VerifiedEvidence[];
}
export interface DroppedPillar {
  name: string;
  description: string;
  reason: string;
}

export interface ProfileContext {
  sources: EvidenceSource[];
  overlapThreshold: number;
  minQuoteChars: number;
}

type EvidenceCheck = { ok: true; source: EvidenceSource } | { ok: false; code: string; message: string };

export function checkEvidence(ev: { quote: string; source: string }, ctx: ProfileContext): EvidenceCheck {
  const src = ctx.sources.find((s) => s.id === ev.source);
  if (!src) return { ok: false, code: 'unknown_source', message: `출처 ${ev.source} 가 없습니다. 목록에 있는 출처 ID 만 쓰세요.` };
  if (normalizeForQuote(ev.quote).length < ctx.minQuoteChars) {
    return { ok: false, code: 'quote_too_short', message: `인용 "${ev.quote}" 이 너무 짧아 근거가 되지 않습니다. 답의 문장을 더 길게 옮기세요.` };
  }
  if (!quoteInSources(ev.quote, [src.text])) {
    return { ok: false, code: 'quote_not_in_source', message: `인용 "${ev.quote}" 이 ${ev.source}(${src.label})의 답에 없습니다. 답 부분을 그대로 옮기세요.` };
  }
  return { ok: true, source: src };
}

/** 축 하나의 유효한 근거: 원문 대조를 통과하고, 사용자가 직접 입력한 답에서 온 것 */
export function validEvidence(p: ProfileDraft['pillars'][number], ctx: ProfileContext): VerifiedEvidence[] {
  const out: VerifiedEvidence[] = [];
  for (const ev of p.evidence) {
    const c = checkEvidence(ev, ctx);
    if (c.ok && c.source.countsAsUserInput) out.push({ quote: ev.quote, source: ev.source, sourceLabel: c.source.label, countsAsUserInput: true });
  }
  return out;
}

export function profileRules(ctx: ProfileContext): Rule<ProfileDraft>[] {
  const userTexts = ctx.sources.filter((s) => s.countsAsUserInput).map((s) => s.text);
  return [
    // 인용마다 출처 대조
    (d) =>
      d.pillars.flatMap((p, i) =>
        p.evidence.flatMap((ev, j): Issue[] => {
          const c = checkEvidence(ev, ctx);
          return c.ok ? [] : [{ level: 'error', code: c.code, where: `pillars.${i}.evidence.${j}`, message: c.message, from: 'rule' }];
        }),
      ),
    // 직접 입력한 근거가 하나도 없는 축 (예시를 그대로 고른 답만으로 근거를 대는 축 포함)
    (d) =>
      d.pillars.flatMap((p, i): Issue[] => {
        const found = p.evidence.filter((ev) => checkEvidence(ev, ctx).ok);
        if (found.length === 0 || validEvidence(p, ctx).length > 0) return [];
        return [
          {
            level: 'error',
            code: 'example_only_evidence',
            where: `pillars.${i}`,
            message: `축 "${p.name}" 의 근거가 예시 답을 그대로 고른 답뿐입니다. 사용자가 직접 쓴 답에서 인용하거나 이 축을 빼세요.`,
            from: 'rule',
          },
        ];
      }),
    // 축끼리 겹침
    (d) => {
      const out: Issue[] = [];
      for (let i = 0; i < d.pillars.length; i++)
        for (let j = i + 1; j < d.pillars.length; j++) {
          const a = d.pillars[i]!;
          const b = d.pillars[j]!;
          const score = similarity(`${a.name} ${a.description}`, `${b.name} ${b.description}`);
          if (score >= ctx.overlapThreshold)
            out.push({
              level: 'error',
              code: 'pillar_overlap',
              where: `pillars.${j}`,
              message: `축 "${a.name}" 과 "${b.name}" 이 겹칩니다(유사도 ${score.toFixed(2)}). 하나로 합치세요.`,
              from: 'rule',
            });
        }
      return out;
    },
    // 답에 없는 숫자·영문 이름 (허용 출처 4: 사용자가 직접 입력한 문장)
    (d) => {
      const fields: Array<[string, string]> = [
        ['account_line', d.account_line],
        ['audience', d.audience],
        ...d.pillars.flatMap((p, i): Array<[string, string]> => [
          [`pillars.${i}.name`, p.name],
          [`pillars.${i}.description`, p.description],
        ]),
      ];
      return fields.flatMap(([where, text]) =>
        findUngrounded(text, { source: userTexts }).map(
          (c): Issue => ({
            level: 'error',
            code: c.kind === 'number' ? 'number_not_in_source' : 'english_not_in_source',
            where,
            message: `답에 없는 ${c.kind === 'number' ? '숫자' : '영문 이름'} "${c.value}" 을(를) 썼습니다.`,
            from: 'rule',
          }),
        ),
      );
    },
  ];
}

export type ProfileOutcome =
  | {
      kind: 'saved';
      draft: Omit<ProfileDraft, 'pillars'> & { pillars: VerifiedPillar[] };
      dropped: DroppedPillar[];
      /** 재작성 끝까지 실패해 근거 없는 축을 빼고 살린 경우 */
      salvaged: boolean;
    }
  /** 근거 있는 축이 3개 미만 — 인터뷰로 돌아가 더 묻는다 (10턴이면 부르는 쪽이 실패 안내) */
  | { kind: 'needs_more'; missing: string[]; dropped: DroppedPillar[] }
  /** 구제할 수 없는 실패 (축 겹침·지어낸 숫자 등이 남음) */
  | { kind: 'failed'; errors: Issue[] };

const EVIDENCE_CODES = new Set(['unknown_source', 'quote_too_short', 'quote_not_in_source', 'example_only_evidence']);

function pillarIndexOf(where: string | undefined): number | null {
  const m = /^pillars\.(\d+)/.exec(where ?? '');
  return m ? Number(m[1]) : null;
}

/**
 * 구제 단계: 근거 없는 축을 빼고, 남은 축의 인용은 유효한 것만 남긴다. 그 뒤 남은 문제가 없을 때만 저장할 수 있다.
 * 자기 평가의 지적은 그 축이 빠질 때만 함께 사라진다 — 남는 축에 사실 오류 지적이 있으면 구제하지 않는다.
 */
export function salvage(draft: ProfileDraft, errors: Issue[], ctx: ProfileContext, minPillars: number): ProfileOutcome {
  const kept: VerifiedPillar[] = [];
  const dropped: DroppedPillar[] = [];
  const droppedIdx = new Set<number>();
  draft.pillars.forEach((p, i) => {
    const evidence = validEvidence(p, ctx);
    if (evidence.length > 0) {
      kept.push({ name: p.name, description: p.description, evidence });
      return;
    }
    const usedExample = p.evidence.some((ev) => {
      const c = checkEvidence(ev, ctx);
      return c.ok && !c.source.countsAsUserInput;
    });
    droppedIdx.add(i);
    dropped.push({ name: p.name, description: p.description, reason: usedExample ? '예시를 고른 답만 근거로 댐' : '답에서 찾을 수 있는 인용이 없음' });
  });

  // 근거 문제는 축을 빼거나 무효 인용을 덜어 내면 사라진다. 그 밖의 문제는 빠지는 축에 속할 때만 함께 사라진다
  const remaining = errors.filter((e) => !EVIDENCE_CODES.has(e.code) && !droppedIdx.has(pillarIndexOf(e.where) ?? -1));
  if (remaining.length > 0) return { kind: 'failed', errors: remaining };

  // 남은 축만으로 규칙을 한 번 더 확인한다 — 저장되는 것은 반드시 규칙을 통과한 것이어야 하므로
  const rest: ProfileDraft = {
    ...draft,
    pillars: kept.map((p) => ({ name: p.name, description: p.description, evidence: p.evidence.map((e) => ({ quote: e.quote, source: e.source })) })),
  };
  const again = profileRules(ctx).flatMap((r) => r(rest)).filter((i) => i.level === 'error');
  if (again.length > 0) return { kind: 'failed', errors: again };

  if (kept.length < minPillars) {
    return { kind: 'needs_more', missing: [...draft.unknown, ...dropped.map((d) => `${d.name}: ${d.reason}`)], dropped };
  }
  return { kind: 'saved', draft: { ...draft, pillars: kept }, dropped, salvaged: true };
}

export interface ProfileRunResult {
  outcome: ProfileOutcome;
  jobId: string;
  calls: number;
  rewrites: number;
  warnings: Issue[];
}

export async function runProfile(ai: AiService, sources: EvidenceSource[], job?: JobContext): Promise<ProfileRunResult> {
  const ctx: ProfileContext = {
    sources,
    overlapThreshold: getSetting(ai.db, 'identity.pillarOverlapThreshold'),
    minQuoteChars: getSetting(ai.db, 'identity.minQuoteChars'),
  };
  const minPillars = 3;
  const prompt = loadPrompt(ai.db, 'identity_profile', { sources: formatSourcesForPrompt(sources) });
  const r = await generateChecked(
    ai,
    { task: 'identity_profile', prompt: prompt.text, promptRef: prompt.ref, schema: ProfileSchema, rules: profileRules(ctx), signal: job?.signal },
    job,
  );
  const meta = { jobId: r.jobId, calls: r.calls, rewrites: r.rewrites, warnings: r.warnings };
  if (!r.ok) return { ...meta, outcome: salvage(r.rejected, r.errors, ctx, minPillars) };

  const pillars = r.data.pillars.map((p) => ({ name: p.name, description: p.description, evidence: validEvidence(p, ctx) }));
  if (pillars.length < minPillars) {
    return { ...meta, outcome: { kind: 'needs_more', missing: r.data.unknown, dropped: [] } };
  }
  return { ...meta, outcome: { kind: 'saved', draft: { ...r.data, pillars }, dropped: [], salvaged: false } };
}
