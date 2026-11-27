// Metricool 연결 한 줄(설정 → 연결된 계정) — 연결 · 다시 연결 · 끊기 · 브랜드 고르기
import { useCallback, useEffect, useState } from 'react';
import { blogCall } from '../blog/useBlogJob.tsx';
import { Badge } from './settingsRows.tsx';

interface MetricoolConn {
  connected: boolean;
  needsReconnect: boolean;
  /** 로그인을 마친 시각(ms, 서버 시계). 모르면 null */
  connectedAt: number | null;
  /** 키체인 저장 실패 같은 안내. 없으면 null */
  warning: string | null;
  brandId: string | null;
}
interface MetricoolBrand {
  id: string;
  label: string;
  timezone: string | null;
  instagram: string | null;
}

/** Metricool 한 줄(성과 분석, 결정 2026-11-22) — 앱이 Metricool 공식 MCP 서버에 직접 붙어 숫자를 읽기만 한다(범위 mcp:read). 토큰은 키체인에만 */
export function MetricoolRow() {
  const [st, setSt] = useState<MetricoolConn | null>(null);
  const [brands, setBrands] = useState<MetricoolBrand[] | null>(null);
  /** 기다리는 중이면 「연결」을 누를 때의 연결 시각(없으면 null) — 그보다 새 연결이 생겨야 끝난 것 */
  const [waiting, setWaiting] = useState<{ before: number | null } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(
    () =>
      blogCall<MetricoolConn>('GET', '/api/insights/metricool').then((r) => {
        if (r.ok) setSt(r.data);
        return r.ok ? r.data : null;
      }),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const on = !!st?.connected && !st.needsReconnect;
  // 저장한 브랜드가 지금 목록에 있나 — 없으면(다른 계정으로 다시 연결 등) 브랜드가 하나여도 고르는 칸을 보인다
  const brandOk = st?.brandId == null ? (brands?.length ?? 0) <= 1 : !!brands?.some((b) => b.id === st.brandId);
  // 연결돼 있을 때만 브랜드 목록을 읽는다(Metricool 을 부르는 요청) — 연결이 끊기면 목록은 보이지 않는다(아래 on 조건).
  // 다시 연결하면(연결 시각이 바뀌면) 다른 계정일 수 있어 다시 읽는다
  const connectedAt = st?.connectedAt ?? null;
  useEffect(() => {
    if (!on) return;
    void blogCall<{ brands: MetricoolBrand[] }>('GET', '/api/insights/metricool/brands').then((r) => (r.ok ? setBrands(r.data.brands) : setMsg({ ok: false, text: r.data.error ?? '브랜드를 읽지 못했어요.' })));
  }, [on, connectedAt]);
  // 로그인 창에서 돌아오기를 기다린다 — 2초마다, 10분까지
  useEffect(() => {
    if (!waiting) return;
    const until = Date.now() + 10 * 60_000;
    const t = setInterval(() => {
      void load().then((s) => {
        // 「다시 연결」이면 이미 연결돼 있어서 connected 만으로는 모른다 — 누른 뒤에 생긴 연결(시각이 더 새것)일 때만 끝
        const fresh = s?.connectedAt != null && (waiting.before === null || s.connectedAt > waiting.before);
        if (s?.connected && !s.needsReconnect && fresh) {
          setWaiting(null);
          setMsg({ ok: true, text: 'Metricool 을 연결했어요.' });
        } else if (Date.now() > until) {
          setWaiting(null);
          setMsg({ ok: false, text: '로그인을 기다리다 그만뒀어요. 다시 「연결」을 누르세요.' });
        }
      });
    }, 2000);
    return () => clearInterval(t);
  }, [waiting, load]);
  const connect = async () => {
    setMsg(null);
    // 창은 누른 그 순간 연다(주소를 받은 뒤 열면 팝업 차단에 걸려서). 열린 창이 이 화면을 건드리지 못하게 opener 를 끊는다
    const w = window.open('', '_blank');
    if (w) w.opener = null;
    const r = await blogCall<{ url: string; connectedAt: number | null }>('POST', '/api/insights/metricool/connect');
    if (!r.ok) {
      w?.close();
      return setMsg({ ok: false, text: r.data.error ?? '연결을 시작하지 못했어요.' });
    }
    if (w) w.location.href = r.data.url;
    else window.location.assign(r.data.url);
    setWaiting({ before: r.data.connectedAt });
  };
  const disconnect = async () => {
    if (!window.confirm('Metricool 연결을 끊을까요? 이 컴퓨터의 연결 토큰을 지워요. 이미 받아 둔 성과 숫자는 그대로 남아요.')) return;
    const r = await blogCall<MetricoolConn>('DELETE', '/api/insights/metricool');
    if (r.ok) setSt(r.data);
    setMsg({ ok: true, text: '연결을 끊었어요.' });
  };
  const pick = async (brandId: string) => {
    const r = await blogCall<MetricoolConn>('PUT', '/api/insights/metricool/brand', { brandId: brandId || null });
    if (r.ok) setSt(r.data);
  };
  return (
    <div className="set-row">
      <div className="set-label">
        <div className="set-title">
          Metricool {!st ? <Badge tone="off">확인하는 중…</Badge> : on ? <Badge tone="ok">연결됨 · 읽기만</Badge> : st.needsReconnect ? <Badge tone="warn">다시 연결 필요</Badge> : <Badge tone="off">연결 안 됨</Badge>}
        </div>
        <div className="set-desc">
          「성과」에서 쓰는 게시물 숫자를 Metricool 에서 이 앱이 직접 받아 와요(AI 를 거치지 않아요). 읽기 권한(mcp:read)만 받고, 연결 토큰은 이 컴퓨터의 키체인에만 저장해요. 무료 요금제로도 돼요.
          {on && brands && (brands.length > 1 || !brandOk) && brands.length > 0 && (
            <span className="block">
              <label className="small">
                쓸 브랜드{' '}
                <select value={brandOk ? (st?.brandId ?? '') : ''} onChange={(e) => void pick(e.target.value)}>
                  <option value="">고르세요</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                      {b.instagram ? ` (@${b.instagram})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </span>
          )}
          {on && brands && brands.length === 1 && brandOk && <span className="block">브랜드: {brands[0]!.label}{brands[0]!.instagram ? ` (@${brands[0]!.instagram})` : ''}</span>}
        </div>
      </div>
      <div className="set-control">
        <div className="set-actions">
          <button type="button" className="small" disabled={!!waiting} onClick={() => void connect()}>
            {waiting ? '로그인 기다리는 중…' : on ? '다시 연결' : '연결'}
          </button>
          {st?.connected && (
            <button type="button" className="small ghost" onClick={() => void disconnect()}>
              연결 끊기
            </button>
          )}
        </div>
        {waiting && <p className="muted small">열린 창에서 Metricool 에 로그인하고 허용을 누르세요.</p>}
        {st?.warning && <p className="status small error">{st.warning}</p>}
        {msg && <p className={`status small ${msg.ok ? 'ok' : 'error'}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
