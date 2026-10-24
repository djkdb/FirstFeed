// 폰으로 받기 (FR-PB-5 · 결정 2026-10-24): 업로드 폴더 하나를 같은 와이파이의 휴대폰에서 받게 QR 을 보인다.
// 같은 네트워크에 여는 일이라 무엇이 열리고 언제 닫히는지를 화면에 늘 보인다(같은 와이파이 · 처음 연 기기 하나 · 10분 · 지금 닫기)
import { useEffect, useState } from 'react';

interface Share {
  url: string;
  qrSvg: string;
  expiresAt: string;
  exportId: number;
  files: number;
  hasCaption: boolean;
  opened: boolean;
}

const call = async (url: string, method: string): Promise<Share | null> => {
  const r = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: method === 'POST' ? '{}' : undefined });
  const b = (await r.json()) as { share?: Share | null; error?: string };
  if (!r.ok || b.error) throw new Error(b.error ?? '요청이 실패했습니다.');
  return b.share ?? null;
};

export function PhoneShare({ exportId }: { exportId: number }) {
  const [share, setShare] = useState<Share | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 열려 있는 동안만 상태를 묻는다 — 휴대폰이 열었는지, 시간이 지나 닫혔는지
  useEffect(() => {
    if (!share) return;
    const t = setInterval(() => {
      void call('/api/publish/phone', 'GET')
        .then((s) => setShare(s && s.exportId === exportId ? s : null))
        .catch(() => setShare(null));
    }, 3000);
    return () => clearInterval(t);
  }, [share, exportId]);

  const run = (method: string, url: string) => {
    setBusy(true);
    setError(null);
    call(url, method)
      .then(setShare)
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  if (!share)
    return (
      <>
        <button type="button" disabled={busy} onClick={() => run('POST', `/api/publish/exports/${exportId}/phone`)}>
          폰으로 받기
        </button>
        {error && <span className="status error small"> {error}</span>}
      </>
    );
  return (
    <div className="phone-share">
      <img className="phone-qr" alt="휴대폰 카메라로 찍을 QR" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(share.qrSvg)}`} />
      <div>
        <p>
          <strong>휴대폰 카메라로 QR 을 찍으세요.</strong> 그림 {share.files}장{share.hasCaption ? ' · 캡션' : ''}을 받을 수 있어요.
        </p>
        <p className="small">
          같은 와이파이의 기기에서만 · 처음 연 기기 하나만 · <strong>{new Date(share.expiresAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</strong>에 저절로 닫힘
        </p>
        <p className="small">{share.opened ? '휴대폰에서 열었어요.' : '아직 열지 않았어요.'}</p>
        <p className="small muted">
          주소: <code>{share.url}</code>
        </p>
        <p className="small muted">QR 이 안 열리면: 휴대폰이 같은 와이파이인지, 이 컴퓨터 방화벽이 「node」의 들어오는 연결을 막지 않는지 확인하세요.</p>
        <button type="button" disabled={busy} onClick={() => run('DELETE', '/api/publish/phone')}>
          지금 닫기
        </button>
        {error && <span className="status error small"> {error}</span>}
      </div>
    </div>
  );
}
