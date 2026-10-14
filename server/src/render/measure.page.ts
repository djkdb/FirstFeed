/// <reference lib="dom" />
// 브라우저 안에서 도는 넘침 측정 (render.ts 가 page.evaluate 로 넘긴다).
// DOM 타입이 필요해서 따로 둔 파일 — 이 파일의 함수는 브라우저에서 돌므로 Node API·바깥 변수를 쓰지 않는다.
// (lib dom 참조는 서버 프로그램 전체에 DOM 타입을 보이게 하는 부작용이 있다 — 서버 코드에서 document 같은 이름을 쓰지 않게 주의)

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SlotMeasure {
  slot: string;
  maxLines: number | null;
  lines: number;
  /** 칸 안에서 넘침 (scroll 크기 > 칸 크기) */
  overflowX: boolean;
  overflowY: boolean;
  /** 글자가 실제로 그려진 범위 */
  text: Rect | null;
  /** 글자가 칸·카드·안전 영역 밖으로 나간 정도(px). 0 이면 안 나감 */
  outsideSlot: number;
  outsideCard: number;
  outsideSafe: number;
}

export interface Measure {
  slots: SlotMeasure[];
  overlaps: Array<{ a: string; b: string; area: number }>;
}

export /** 브라우저 안에서 도는 측정. 문자열로 넘어가므로 바깥 변수를 쓰지 않는다 */
function measureInPage(opts: { width: number; height: number; safe: Rect | null }): Measure {
  const toRect = (r: DOMRect) => ({ x: r.left, y: r.top, w: r.width, h: r.height });
  const textRects = (el: Element): DOMRect[] => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
  };
  const union = (rs: DOMRect[]) => {
    if (rs.length === 0) return null;
    const x1 = Math.min(...rs.map((r) => r.left));
    const y1 = Math.min(...rs.map((r) => r.top));
    const x2 = Math.max(...rs.map((r) => r.right));
    const y2 = Math.max(...rs.map((r) => r.bottom));
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  };
  // 줄 수: 글자 조각들의 세로 범위가 반 이상 겹치면 같은 줄
  const countLines = (rs: DOMRect[]) => {
    const lines: Array<{ top: number; bottom: number }> = [];
    for (const r of [...rs].sort((a, b) => a.top - b.top)) {
      const same = lines.find((l) => Math.min(l.bottom, r.bottom) - Math.max(l.top, r.top) > Math.min(l.bottom - l.top, r.height) * 0.5);
      if (same) {
        same.top = Math.min(same.top, r.top);
        same.bottom = Math.max(same.bottom, r.bottom);
      } else lines.push({ top: r.top, bottom: r.bottom });
    }
    return lines.length;
  };
  const beyond = (inner: { x: number; y: number; w: number; h: number } | null, outer: { x: number; y: number; w: number; h: number }) =>
    inner ? Math.max(0, outer.x - inner.x, outer.y - inner.y, inner.x + inner.w - (outer.x + outer.w), inner.y + inner.h - (outer.y + outer.h)) : 0;

  const card = { x: 0, y: 0, w: opts.width, h: opts.height };
  const slots = [...document.querySelectorAll<HTMLElement>('[data-slot]')].map((el) => {
    const rs = textRects(el);
    const text = union(rs);
    const max = el.dataset.maxLines ? Number(el.dataset.maxLines) : null;
    return {
      slot: el.dataset.slot!,
      maxLines: max,
      lines: countLines(rs),
      overflowX: el.scrollWidth - el.clientWidth > 1,
      overflowY: el.scrollHeight - el.clientHeight > 1,
      text,
      outsideSlot: beyond(text, toRect(el.getBoundingClientRect())),
      outsideCard: beyond(text, card),
      outsideSafe: opts.safe ? beyond(text, opts.safe) : 0,
    };
  });
  // 겹침: 글 칸의 글자 범위끼리, 그리고 글자 범위와 [data-box] 상자
  const shapes = [
    ...slots.filter((s) => s.text).map((s) => ({ name: s.slot, r: s.text! })),
    ...[...document.querySelectorAll<HTMLElement>('[data-box]')].map((el) => ({ name: `box:${el.dataset.box}`, r: toRect(el.getBoundingClientRect()) })),
  ];
  const overlaps: Array<{ a: string; b: string; area: number }> = [];
  for (let i = 0; i < shapes.length; i++)
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i]!;
      const b = shapes[j]!;
      if (a.name.startsWith('box:') && b.name.startsWith('box:')) continue; // 상자끼리는 템플릿이 정한 배치
      const w = Math.min(a.r.x + a.r.w, b.r.x + b.r.w) - Math.max(a.r.x, b.r.x);
      const h = Math.min(a.r.y + a.r.h, b.r.y + b.r.h) - Math.max(a.r.y, b.r.y);
      if (w > 2 && h > 2) overlaps.push({ a: a.name, b: b.name, area: Math.round(w * h) });
    }
  return { slots, overlaps };
}

