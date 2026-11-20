// 개성 캐릭터 추천 측정(2026-11-08): 프로필 스냅숏 + 브랜드 키트(고정 입력)로 앱과 같은 경로(suggestCharacters — 생성 → 코드 규칙 → 재작성)를 돌린다.
// 통과 · 재작성 · 걸린 규칙 · 토큰과 세 안, 첫 안의 조립된 프롬프트를 남긴다(사람이 읽고 판정).
//   npm run eval:character -- --runs=1 --label=v1 [--cloud-session]
// 결과: tests/results/<날짜>-character-<label>.md · .json
import fs from 'node:fs';
import path from 'node:path';
import { env, getSetting } from '../server/src/config.ts';
import { openDb } from '../server/src/db/index.ts';
import { AiService } from '../server/src/ai/adapter.ts';
import { ClaudeCodeProvider, isSubscriptionAuth, type AuthStatus } from '../server/src/ai/providers/claude-code.ts';
import { saveSelection } from '../server/src/brand/store.ts';
import { characterPrompts } from '../server/src/brand/character.ts';
import { suggestCharacters } from '../server/src/brand/characterSuggest.ts';
import { saveProfileVersion } from '../server/src/identity/store.ts';
import type { ProfileContent } from '../server/src/identity/model.ts';

const args = process.argv.slice(2);
const runs = Number(args.find((a) => a.startsWith('--runs='))?.slice(7) ?? 1);
const label = args.find((a) => a.startsWith('--label='))?.slice(8) ?? 'run';
const cloud = args.includes('--cloud-session');
if (cloud && process.env.CLAUDE_CODE_REMOTE !== 'true') throw new Error('--cloud-session 은 Claude Code 원격 세션 컨테이너(CLAUDE_CODE_REMOTE=true)에서만 씁니다');
const acceptAuth = cloud ? (a: AuthStatus, e: NodeJS.ProcessEnv) => isSubscriptionAuth(a, e) || (a.loggedIn === true && a.apiProvider === 'firstParty' && a.authMethod === 'oauth_token') : undefined;

const PEOPLE: Array<[string, string, string]> = [
  ['me', 'real', '실제·공개'],
  ['doyun', 'generated', 'AI 생성'],
  ['seoyeon', 'generated', 'AI 생성'],
];
const rows: Array<Record<string, unknown>> = [];
const md: string[] = [];
for (let run = 1; run <= runs; run++) {
  for (const [id, set, kind] of PEOPLE) {
    const db = openDb(':memory:');
    const kit = JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures', set, 'brands', `${id}.json`), 'utf8')) as { look: { palette: Record<string, string>; titleFont: string; bodyFont: string; handle?: string; displayName?: string } };
    const prof = JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures', set, 'profiles', `${id}.json`), 'utf8')) as { profile: ProfileContent };
    saveSelection(db, 1, null, { palette: { name: id, colors: kit.look.palette as never, why: '' }, titleFont: kit.look.titleFont, bodyFont: kit.look.bodyFont, handle: kit.look.handle ?? null, displayName: kit.look.displayName ?? null });
    saveProfileVersion(db, 1, prof.profile, { reason: 'interview', sessionId: null, basedOn: null, jobId: null, activate: true });
    const ai = new AiService({ db, provider: new ClaudeCodeProvider(acceptAuth ? { acceptAuth } : {}) });
    const t0 = Date.now();
    let res: Awaited<ReturnType<typeof suggestCharacters>> | null = null;
    let error: string | null = null;
    try {
      res = await suggestCharacters(ai, 1);
    } catch (e) {
      error = (e as Error).message;
    }
    const runsRows = db.prepare("SELECT kind, model, issues_json, input_tokens, cache_creation_tokens, cache_read_tokens, output_tokens FROM ai_runs WHERE task = 'character_suggest' ORDER BY id").all() as Array<Record<string, unknown>>;
    const reasons = runsRows.flatMap((r) => ((JSON.parse(String(r.issues_json ?? '[]')) as Array<{ level: string; code: string }>) ?? []).filter((i) => i.level === 'error').map((i) => i.code));
    const sum = (k: string) => runsRows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
    const row = { run, id, kind, ok: !!res, rewrites: res?.rewrites ?? null, seconds: Math.round((Date.now() - t0) / 1000), reasons, error, model: runsRows.find((r) => r.model)?.model ?? null, tokens: { input: sum('input_tokens'), cacheWrite: sum('cache_creation_tokens'), cacheRead: sum('cache_read_tokens'), output: sum('output_tokens') }, candidates: res?.candidates ?? [] };
    rows.push(row);
    console.log(`${run}회 ${id}: ${row.ok ? '통과' : '실패'} · 재작성 ${row.rewrites ?? '-'} · ${row.seconds}초${reasons.length ? ` · ${reasons.join(',')}` : ''}${error ? ` · ${error}` : ''}`);
    md.push(`## ${run}회 · ${id}(${kind}) — ${row.ok ? `통과 · 재작성 ${row.rewrites}` : `실패: ${error}`} · ${row.seconds}초`, '');
    for (const c of res?.candidates ?? []) md.push(`- **${c.name}** — ${c.concept} / ${c.why}  \n  \`${c.kind}/${c.species}/${c.style}/${c.line}/${c.shading}\` · 소품 ${c.accessories.join(', ') || '-'} · 성격 ${c.personality.join(', ') || '-'} · 색 ${c.body_color}/${c.accent_color}`);
    if (res?.candidates[0]) md.push('', '첫 안의 조립된 프롬프트(캐릭터 한 장):', '', '```', characterPrompts(res.candidates[0].spec, kit.look.palette as never).main, '```');
    md.push('');
  }
}
const date = new Date().toLocaleDateString('sv-SE');
const head = [
  `# 개성 캐릭터 추천 측정 — ${label} (${date})`,
  '',
  `- 프롬프트: character_suggest ${getSetting(null, 'prompts.activeVersions').character_suggest ?? 'v1'} · 모델 설정 ${getSetting(null, 'ai.taskModels').character_suggest} · 실제 모델 ${[...new Set(rows.map((r) => r.model).filter(Boolean))].join(', ') || '모름'}`,
  '- 입력: 프로필 스냅숏(tests/fixtures/*/profiles) + 브랜드 키트(tests/fixtures/*/brands) — me 실제·공개, doyun · seoyeon AI 생성. 실제·비공개 자료 없음',
  '',
  '| 회 | 사람 | 결과 | 재작성 | 걸린 규칙 | 시간 | 입력 · 캐시 쓰기 · 캐시 읽기 · 출력 토큰 |',
  '|---|---|---|---|---|---|---|',
  ...rows.map((r) => {
    const t = r.tokens as Record<string, number>;
    return `| ${r.run} | ${r.id}(${r.kind}) | ${r.ok ? '통과' : '실패'} | ${r.rewrites ?? '-'} | ${(r.reasons as string[]).join(', ') || '없음'} | ${r.seconds}초 | ${t.input} · ${t.cacheWrite} · ${t.cacheRead} · ${t.output} |`;
  }),
  '',
];
fs.writeFileSync(path.join(env.repoRoot, 'tests/results', `${date}-character-${label}.md`), [...head, ...md, '사람이 읽은 판정은 devlog 에 적는다.'].join('\n') + '\n');
fs.writeFileSync(path.join(env.repoRoot, 'tests/results', `${date}-character-${label}.json`), JSON.stringify(rows, null, 1) + '\n');
console.log(`결과: tests/results/${date}-character-${label}.md`);
