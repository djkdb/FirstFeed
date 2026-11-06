// 가이드(격자에 보이는 곳) 밖으로 나간 것 — 편집 화면에서 잰 상자가 있으면 그것, 없으면(지금 안 보이는 글자) 어림
import { estimateTextBox, inside, type Box, type ReelDoc } from '../../../server/src/reels/model.ts';

export const textSig = (t: ReelDoc['texts'][number]) => JSON.stringify([t.text, t.style]);

export function outsideItems(doc: ReelDoc, guide: Box, measured: Map<string, { sig: string; box: Box }>): Array<{ id: string; label: string }> {
  const out: Array<{ id: string; label: string }> = [];
  for (const t of doc.texts) {
    const m = measured.get(t.id);
    const box = m && m.sig === textSig(t) ? m.box : estimateTextBox(t);
    if (!inside(box, guide)) out.push({ id: t.id, label: `글자 「${t.text.slice(0, 12)}」` });
  }
  for (const o of doc.overlays) if (!inside({ x: o.x, y: o.y, w: o.w, h: o.h }, guide)) out.push({ id: o.id, label: '위에 얹은 그림' });
  return out;
}
