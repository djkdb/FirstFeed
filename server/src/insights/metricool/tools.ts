// Metricool MCP 도구 이름과 결과 읽기. 숫자는 여기서 그대로 꺼내 DB 로 간다 — AI 가 숫자를 만지지 않는다(결정 2026-11-22).
// 도구 이름 · 인자 · 결과 모양은 2026-11-22 Claude 의 Metricool 커넥터로 본 것이다. **앱이 실제 서버에서 직접 부른 적은 아직 없다**
// (이 컨테이너에서는 사용자 로그인을 할 수 없어서) — 실제로 다르면 이 파일만 고친다.
// 개인정보: getBrandSettings 결과에는 계정 주인 이메일 등이 같이 온다 → id · label · timezone · 인스타 아이디만 남기고 나머지는 읽자마자 버린다

export const TOOL = {
  /** 인자 없음 → { data: [{ id, label, timezone, networksData: { instagramData }, … }] } */
  brands: 'getBrandSettings',
  /** { brandId: string, from: ISO(시간대 포함), to, metrics: string[] } → { rows: [[값…]] } (값은 metrics 순서, 대개 글자) */
  analytics: 'getAnalyticsDataByMetrics',
} as const;

export interface MetricoolBrand {
  id: string;
  label: string;
  timezone: string | null;
  instagram: string | null;
}

export function parseBrands(v: unknown): MetricoolBrand[] {
  const list = (v as { data?: unknown })?.data;
  if (!Array.isArray(list)) return [];
  return list.flatMap((b: Record<string, unknown>) => {
    if (b === null || typeof b !== 'object' || (typeof b.id !== 'number' && typeof b.id !== 'string')) return [];
    const nd = (b.networksData ?? {}) as Record<string, unknown>;
    const ig = typeof nd.instagramData === 'string' && nd.instagramData.trim() ? nd.instagramData.trim() : null;
    return [{ id: String(b.id), label: typeof b.label === 'string' ? b.label : String(b.id), timezone: typeof b.timezone === 'string' ? b.timezone : null, instagram: ig }];
  });
}

/** 그 시간대에서 utcMs 시각의 UTC 차이(ms). 서울이면 +9시간 */
export function tzOffsetMs(tz: string, utcMs: number): number {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** 그 시간대의 벽시계 시각(연 · 월 · 일 · 시 · 분 · 초) → UTC ms. 시간대를 모르면 null */
export function zonedToUtc(tz: string, y: number, mo: number, d: number, h: number, mi: number, s: number): number | null {
  try {
    const guess = Date.UTC(y, mo - 1, d, h, mi, s);
    let utc = guess - tzOffsetMs(tz, guess);
    utc = guess - tzOffsetMs(tz, utc); // 서머타임 경계에서 한 번 더 맞춘다
    return utc;
  } catch {
    return null;
  }
}

/** Metricool 날짜 값 → ISO(UTC). 「20261118092331」(YYYYMMDDHHMMSS)는 브랜드 시간대의 시각으로 읽는다. 모르는 모양은 null */
export function parseStamp(v: unknown, tz: string | null): string | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v).trim();
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(s);
  if (m) {
    const [y, mo, d, h, mi, se] = m.slice(1).map(Number) as [number, number, number, number, number, number];
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || se > 59) return null;
    const utc = tz ? zonedToUtc(tz, y, mo, d, h, mi, se) : null;
    return utc === null ? null : new Date(utc).toISOString();
  }
  // 시간대가 붙은 ISO 면 그대로 믿는다(시간대 없는 글은 어느 시각인지 몰라 버린다)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  }
  return null;
}

/** 그 시간대의 시각 글(「2026-11-18T00:00:00+09:00」) — 도구의 from · to 인자 */
export function isoInZone(utcMs: number, tz: string): string {
  const off = tzOffsetMs(tz, utcMs);
  const local = new Date(Math.floor(utcMs / 1000) * 1000 + off).toISOString().slice(0, 19);
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off) / 60_000;
  return `${local}${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

/** 숫자 칸: 「""」 · 없음 · 숫자 아닌 글 → null(0 으로 바꾸지 않는다). 「1,234」 도 읽는다 */
export function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/,(?=\d{3}(?!\d))/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : typeof v === 'number' ? String(v) : null);

export interface FetchedPost {
  externalId: string;
  url: string | null;
  type: string | null;
  publishedAt: string | null;
  content: string | null;
  reach: number | null;
  saved: number | null;
  shares: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
}

/** 요청할 측정 항목 순서 — 결과 행의 값이 이 순서로 온다 */
export function metricOrder(fields: Record<string, string>): Array<[key: string, fieldId: string]> {
  return Object.entries(fields).filter(([, id]) => typeof id === 'string' && id.length > 0);
}

/** { rows: [[…]] } → 게시물. ID 가 없는 행은 버린다(어느 게시물인지 몰라 고칠 수 없어서) */
export function parseRows(v: unknown, fields: Record<string, string>, tz: string | null, fixedType: string | null): FetchedPost[] {
  const rows = (v as { rows?: unknown })?.rows;
  if (!Array.isArray(rows)) return [];
  const order = metricOrder(fields);
  return rows.flatMap((row) => {
    if (!Array.isArray(row)) return [];
    const at = (k: string) => {
      const i = order.findIndex(([key]) => key === k);
      return i >= 0 ? row[i] : undefined;
    };
    const id = str(at('id'));
    if (!id) return [];
    return [
      {
        externalId: id.trim(),
        url: str(at('url')),
        type: fixedType ?? str(at('type')),
        publishedAt: parseStamp(at('publishedAt'), tz),
        content: str(at('content')),
        reach: num(at('reach')),
        saved: num(at('saved')),
        shares: num(at('shares')),
        views: num(at('views')),
        likes: num(at('likes')),
        comments: num(at('comments')),
      },
    ];
  });
}
