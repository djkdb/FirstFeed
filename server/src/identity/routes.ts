// 정체성 API. AI 단계(다음 질문·프로필)는 작업 ID 를 먼저 돌려주고 화면이 상태를 묻는다 (취소 가능).
import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';
import type { AiService } from '../ai/adapter.ts';
import type { JobStore } from '../ai/jobs.ts';
import { getSetting } from '../config.ts';
import { answerTurn, askNext, FlowError, makeProfile } from './flow.ts';
import { activeProfile, confirmProfile, createSession, getSessionState, latestSessionId, listProfiles } from './store.ts';
import { EditError, EditInput, rollbackTo, saveEdit } from './edit.ts';
import { SURVEY, SurveyAnswers, validateSurvey } from './survey.ts';

const BRAND_ID = 1; // 브랜드 여러 개(FR-AC-3)는 F 범위 — 지금은 로컬 브랜드 하나
const Answer = z.object({ turnNo: z.number().int().positive(), answer: z.string().max(1000).default(''), unknown: z.boolean().default(false) });

const bad = (message: string) => ({ error: message });

export function identityRoutes(ai: AiService, jobs: JobStore) {
  const db = ai.db;
  const limits = () => ({ minTurns: getSetting(db, 'identity.minTurns'), maxTurns: getSetting(db, 'identity.maxTurns') });
  return new Hono()
    .get('/survey', (c) => c.json({ questions: SURVEY }))
    .get('/current', (c) => {
      const id = latestSessionId(db, BRAND_ID);
      return c.json({ state: id === null ? null : getSessionState(db, id), ...limits() });
    })
    .post(
      '/sessions',
      validator('json', (value, c) => {
        const body = z.object({ survey: SurveyAnswers }).safeParse(value);
        if (!body.success) return c.json(bad('설문 답의 형식이 맞지 않습니다. 화면을 새로고침한 뒤 다시 제출하세요.'), 400);
        const problems = validateSurvey(body.data.survey);
        if (problems.length) return c.json(bad(problems.join(' ')), 400);
        return body.data;
      }),
      (c) => {
        const id = createSession(db, BRAND_ID, c.req.valid('json').survey);
        return c.json({ state: getSessionState(db, id), ...limits() });
      },
    )
    .post('/sessions/:id/next', (c) => {
      const id = Number(c.req.param('id'));
      const jobId = jobs.start('identity_followup', (job) => askNext(ai, id, job));
      return c.json({ jobId });
    })
    .post(
      '/sessions/:id/answer',
      validator('json', (value, c) => {
        const body = Answer.safeParse(value);
        return body.success ? body.data : c.json(bad('답의 형식이 맞지 않습니다. 다시 보내 주세요.'), 400);
      }),
      (c) => {
        const id = Number(c.req.param('id'));
        const { turnNo, answer, unknown } = c.req.valid('json');
        try {
          answerTurn(ai, id, turnNo, answer, unknown);
        } catch (err) {
          if (err instanceof FlowError) return c.json(bad(`${err.message} ${err.hint}`), 400);
          throw err;
        }
        return c.json({ state: getSessionState(db, id), ...limits() });
      },
    )
    .post('/sessions/:id/profile', (c) => {
      const id = Number(c.req.param('id'));
      const jobId = jobs.start('identity_profile', (job) => makeProfile(ai, id, job));
      return c.json({ jobId });
    })
    // 판 목록(이력)과 활성 판
    .get('/profiles', (c) => {
      const active = activeProfile(db, BRAND_ID);
      const versions = listProfiles(db, BRAND_ID).map((p) => ({
        id: p.id,
        version: p.version,
        reason: p.reason,
        basedOn: p.basedOn,
        createdAt: p.createdAt,
        isActive: active?.id === p.id,
        accountLine: p.accountLine,
        pillarNames: p.pillars.map((x) => x.name),
      }));
      return c.json({ active, versions });
    })
    // 직접 수정: 새 판, 바로 활성
    .put(
      '/profiles/:id',
      validator('json', (value, c) => {
        const body = EditInput.safeParse(value);
        if (!body.success) {
          const first = body.error.issues[0];
          return c.json(bad(`고친 내용의 형식이 맞지 않습니다 (${first?.path.join('.') ?? ''}: ${first?.message ?? ''}). 글자 수와 빈 칸을 확인하세요.`), 400);
        }
        return body.data;
      }),
      (c) => {
        try {
          const r = saveEdit(db, Number(c.req.param('id')), c.req.valid('json'));
          return c.json({ profileId: r.profileId, changes: r.changes, warnings: r.warnings });
        } catch (err) {
          if (err instanceof EditError) return c.json(bad(`${err.message} ${err.hint}`), 400);
          throw err;
        }
      },
    )
    // 되돌리기: 옛 판을 복사한 새 판, 바로 활성
    .post('/profiles/:id/rollback', (c) => {
      try {
        return c.json({ profileId: rollbackTo(db, Number(c.req.param('id'))) });
      } catch (err) {
        if (err instanceof EditError) return c.json(bad(`${err.message} ${err.hint}`), 400);
        throw err;
      }
    })
    .post('/profiles/:id/confirm', (c) => {
      const ok = confirmProfile(db, Number(c.req.param('id')));
      return ok ? c.json({ ok: true as const }) : c.json(bad('프로필을 찾지 못했습니다. 화면을 새로고침하세요.'), 404);
    });
}
