// 카드뉴스 HTTP: 소재 → 표지 후보(작업) → 고르기 → 본문(작업) → 세트·PNG — 가짜 공급자 + 실제 브라우저
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider } from '../ai/testing/fake-provider.ts';
import type { JobState } from '../ai/jobs.ts';
import { closeBrowser } from '../render/browser.ts';
import { seedBrand } from './testing/setup.ts';

afterAll(() => closeBrowser());
const H = { host: 'localhost:4317', 'content-type': 'application/json' };
const SOURCE = '노트 정리 앱 모아 1.2 버전을 써 봤다. 태그를 붙이면 노트가 자동으로 묶인다. 검색창에 날짜를 쓰면 그날 노트만 보인다. 공유 링크는 7일 뒤 사라진다.';
const P = '1a73b8075a69b404';

describe('카드뉴스 API', () => {
  it('소재부터 세트 PNG 까지', async () => {
    const { db, dataDir } = await seedBrand('me', 'real', 'C');
    const titles = ['모아 써 보니\n**3가지**', '태그만 붙이면\n노트가 묶여요', '날짜만 쓰면\n그날 노트만', '공유 링크는\n7일 뒤 사라져요', '모아 1.2 버전\n**3가지 정리**', '써 보고 알게 된\n3가지'].map((headline) => ({ headline, sub: null, pillar_id: P, why: '' }));
    const ev = ['태그를 붙이면 노트가 자동으로 묶인다.', '검색창에 날짜를 쓰면 그날 노트만 보인다.', '공유 링크는 7일 뒤 사라진다.'];
    const body = { cards: ev.map((e, i) => ({ title: ['태그', '날짜 검색', '공유 링크'][i]!, text: e, evidence: e, image: null, glosses: [] })), closing: { headline: '저장해 두세요', sub: null } };
    const provider = new FakeProvider([{ structured: { titles } }, { structured: { issues: [] } }, { structured: body }, { structured: { issues: [] } }]);
    const app = createApp({ db, ai: new AiService({ db, provider }), dataDir });
    const post = async (p: string, b: unknown) => (await app.request(`/api/cards${p}`, { method: 'POST', headers: H, body: JSON.stringify(b) })).json() as Promise<Record<string, unknown>>;
    const wait = async (jobId: string) => {
      for (let i = 0; i < 400; i++) {
        const s = (await (await app.request(`/api/ai/jobs/${jobId}`, { headers: H })).json()) as JobState;
        if (s.phase !== 'running') return s;
        await new Promise((r) => setTimeout(r, 20));
      }
      throw new Error('작업이 끝나지 않음');
    };

    const { sourceId } = (await post('/sources', { body: SOURCE, memo: null })) as { sourceId: number };
    const covers = await wait(((await post('/covers', { sourceId, requested: 3 })) as { jobId: string }).jobId);
    expect(covers.phase).toBe('done');
    const coverJobId = covers.jobId;
    const bodyJob = await wait(((await post('/body', { coverJobId, index: 0 })) as { jobId: string }).jobId);
    expect(bodyJob.result).toMatchObject({ status: 'saved' });
    const setId = (bodyJob.result as { setId: number }).setId;
    const set = (await (await app.request(`/api/cards/sets/${setId}`, { headers: H })).json()) as { set: { cards: Array<{ pngFile: string }> } };
    expect(set.set.cards).toHaveLength(5);
    const png = await app.request(`/api/cards/sets/${setId}/png/${set.set.cards[0]!.pngFile}`, { headers: H });
    expect(png.headers.get('content-type')).toBe('image/png');
    const list = (await (await app.request('/api/cards', { headers: H })).json()) as { sets: unknown[]; ready: { template: { draftId: string } } };
    expect(list.sets).toHaveLength(1);
    expect(list.ready.template.draftId).toBe('C');
  }, 90_000);
});
