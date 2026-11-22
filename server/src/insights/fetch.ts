// Metricool 에서 게시물 성과를 불러와 DB 에 넣는다(FR-IN-2 · 결정 2026-11-22). AI 없음 — 숫자는 도구 결과에서 바로 DB 로.
// 다시 부르면 수치를 덮어쓴다(도달 · 저장은 시간이 지나며 늘어서). fetched_at 에 받은 시각을 남긴다
import { getSetting, setSetting } from '../config.ts';
import type { Db } from '../db/index.ts';
import { FlowError } from '../identity/flow.ts';
import type { SecretStore } from '../secrets/store.ts';
import { McpClient } from './metricool/mcp.ts';
import { MetricoolAuth } from './metricool/oauth.ts';
import { isoInZone, metricOrder, parseBrands, parseRows, TOOL, type MetricoolBrand } from './metricool/tools.ts';
import { setMeta, upsertFetched } from './store.ts';

const DAY = 86_400_000;

export class Metricool {
  readonly auth: MetricoolAuth;
  private readonly db: Db;
  private readonly fetchImpl: typeof fetch | undefined;
  private readonly now: () => number;

  constructor(o: { db: Db; secrets: SecretStore; fetch?: typeof fetch; now?: () => number }) {
    this.db = o.db;
    this.fetchImpl = o.fetch;
    this.now = o.now ?? Date.now;
    this.auth = new MetricoolAuth({ db: o.db, secrets: o.secrets, fetch: o.fetch, now: this.now });
  }

  private client(): McpClient {
    return new McpClient({ url: getSetting(this.db, 'insights.metricool.mcpUrl'), tokens: this.auth, fetch: this.fetchImpl, timeoutMs: getSetting(this.db, 'insights.fetchTimeoutMs') });
  }

  async brands(client = this.client()): Promise<MetricoolBrand[]> {
    return parseBrands(await client.callTool(TOOL.brands, {}));
  }

  chooseBrand(list: MetricoolBrand[]): MetricoolBrand {
    const want = getSetting(this.db, 'insights.metricool.brandId');
    if (want) {
      const b = list.find((x) => x.id === want);
      if (b) return b;
      throw new FlowError('고른 Metricool 브랜드를 찾지 못했어요.', '설정 → 연결된 계정에서 브랜드를 다시 고르세요.');
    }
    if (list.length === 1) return list[0]!;
    if (list.length === 0) throw new FlowError('Metricool 에 브랜드가 없어요.', 'Metricool 에서 인스타 계정을 브랜드에 연결한 뒤 다시 불러오세요.');
    throw new FlowError('Metricool 에 브랜드가 여러 개예요.', '설정 → 연결된 계정에서 쓸 브랜드를 고르세요.');
  }

  setBrand(id: string | null): void {
    setSetting(this.db, 'insights.metricool.brandId', id);
  }

  /** 불러올 기간의 시작: 최근 fetchDays 일. FirstFeed 를 그보다 먼저 쓰기 시작했으면 그날 − 잇기 범위까지 */
  rangeStart(brandId: number): number {
    const days = getSetting(this.db, 'insights.fetchDays');
    let from = this.now() - days * DAY;
    const firstSet = [...setMeta(this.db, brandId).values()][0]?.createdAt;
    const start = getSetting(this.db, 'home.startDate');
    const dates = [firstSet ? Date.parse(`${firstSet.replace(' ', 'T')}Z`) : NaN, start ? Date.parse(`${start}T00:00:00Z`) : NaN].filter((x) => !Number.isNaN(x));
    const earliest = dates.length ? Math.min(...dates) - getSetting(this.db, 'insights.matchWindowDays') * DAY : Infinity;
    if (earliest < from) from = earliest;
    return from;
  }

  async fetchPosts(brandId: number): Promise<{ added: number; updated: number; received: number; brand: string; warnings: string[]; fetchedAt: string }> {
    const client = this.client();
    const brand = this.chooseBrand(await this.brands(client));
    // 시간대를 모르면 이 컴퓨터의 시간대로 읽는다(로컬 앱이라 대개 같다)
    const tz = brand.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    const from = isoInZone(this.rangeStart(brandId), tz);
    const to = isoInZone(this.now(), tz);
    const pull = async (fields: Record<string, string>, fixedType: string | null) =>
      parseRows(await client.callTool(TOOL.analytics, { brandId: brand.id, from, to, metrics: metricOrder(fields).map(([, id]) => id) }), fields, tz, fixedType);
    const posts = await pull(getSetting(this.db, 'insights.metricool.postFields'), null);
    const warnings: string[] = [];
    let reels: typeof posts = [];
    try {
      reels = await pull(getSetting(this.db, 'insights.metricool.reelFields'), 'REELS');
    } catch (e) {
      // 릴스 항목은 피드와 다른 묶음이라 실패해도 피드 게시물은 살린다
      warnings.push(`릴스는 불러오지 못했어요: ${e instanceof Error ? e.message : String(e)}`);
    }
    const all = [...posts, ...reels];
    const fetchedAt = new Date(this.now()).toISOString();
    const r = upsertFetched(this.db, brandId, all, fetchedAt);
    return { ...r, received: all.length, brand: brand.label, warnings, fetchedAt };
  }
}
