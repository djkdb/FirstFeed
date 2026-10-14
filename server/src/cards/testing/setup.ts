// 카드 테스트·측정용 준비: 고정 세트의 프로필 스냅숏 + 브랜드 키트 + 고정 템플릿 판 + 소재 (실제 브라우저로 글자 수를 잰다)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { env } from '../../config.ts';
import { openDb, type Db } from '../../db/index.ts';
import { saveSelection } from '../../brand/store.ts';
import type { ProfileContent } from '../../identity/model.ts';
import { addAnsweredTurn, createSession, saveProfileVersion } from '../../identity/store.ts';
import type { AnswerKind } from '../../identity/sources.ts';
import type { SurveyAnswers } from '../../identity/survey.ts';
import { measureBudget } from '../../templates/budget.ts';
import { draftById } from '../../templates/index.ts';
import { fixTemplate } from '../../templates/store.ts';
import type { BrandLook } from '../../templates/types.ts';
import { addSource } from '../store.ts';

const read = <T>(rel: string): T => JSON.parse(fs.readFileSync(path.join(env.repoRoot, rel), 'utf8')) as T;

/** person: me · doyun · seoyeon, set: real · generated. db 를 넘기면 그 db 에 (측정 스크립트는 AI 서비스 db 에 넣는다) */
export async function seedBrand(person: string, set: string, draftId: string, db: Db = openDb(':memory:')): Promise<{ db: Db; dataDir: string; pillars: Array<{ id: string; name: string }> }> {
  const interview = read<{ survey: SurveyAnswers; turns: Array<{ question: string; answer: string; answerKind: AnswerKind }> }>(`tests/fixtures/${set}/interviews/${person}.json`);
  const profile = read<{ profile: ProfileContent }>(`tests/fixtures/${set}/profiles/${person}.json`).profile;
  const look = read<{ look: BrandLook }>(`tests/fixtures/${set}/brands/${person}.json`).look;
  const sid = createSession(db, 1, interview.survey);
  for (const t of interview.turns) addAnsweredTurn(db, sid, t.question, t.answer, t.answerKind);
  saveProfileVersion(db, 1, profile, { reason: 'interview', sessionId: sid, basedOn: null, jobId: null, activate: true });
  saveSelection(db, 1, null, {
    palette: { name: look.palette.name ?? '', colors: { primary: look.palette.primary, secondary: look.palette.secondary, accent: look.palette.accent, background: look.palette.background, text: look.palette.text }, why: '' },
    titleFont: look.titleFont,
    bodyFont: look.bodyFont,
    handle: look.handle,
    displayName: look.displayName,
  });
  const draft = draftById(draftId)!;
  const { budget, browser } = await measureBudget(db, draft, look);
  fixTemplate(db, 1, draftId, look, budget, `${browser.kind} ${browser.version}`, null);
  return { db, dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ff-cards-')), pillars: profile.pillars.map((p) => ({ id: p.id, name: p.name })) };
}

export const addTestSource = (db: Db, body: string, memo: string | null = null) => addSource(db, 1, body, null, memo);
